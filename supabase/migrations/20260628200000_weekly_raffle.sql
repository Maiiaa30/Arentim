-- ============================================================================
-- Arentim — WEEKLY RAFFLE (rifa). Buy tickets with Tostões through the week;
-- one communal draw every Sunday 20:00 (UTC). The whole pot goes to one winner
-- — pure redistribution within the friend group, plus a small house seed so the
-- pot is never empty.
--
-- No cron: the draw runs LAZILY. raffle_current() (polled by whoever is on the
-- Rifa page) draws any open raffle whose deadline has passed and opens the next
-- week's, all under an advisory lock — same pattern as the crash/roulette live
-- rooms. The winner is drawn at draw time via CSPRNG (not pre-determined), so
-- there is no hidden info to leak: raffles/tickets are world-readable.
-- Idempotent.
-- ============================================================================

create table if not exists public.raffles (
  id            bigint generated always as identity primary key,
  status        text not null default 'open' check (status in ('open', 'drawn')),
  ticket_price  bigint not null,
  seed          bigint not null default 0,         -- house contribution to the pot
  pot           bigint not null default 0,         -- seed + sum of ticket spends
  total_tickets bigint not null default 0,
  opens_at      timestamptz not null default now(),
  draws_at      timestamptz not null,
  winner_id     uuid references public.profiles (id) on delete set null,
  winner_name   text,
  winning_ticket bigint,
  created_at    timestamptz not null default now(),
  drawn_at      timestamptz
);
create index if not exists raffles_recent_idx on public.raffles (id desc);

create table if not exists public.raffle_tickets (
  id           bigint generated always as identity primary key,
  raffle_id    bigint not null references public.raffles (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  qty          bigint not null check (qty > 0),
  created_at   timestamptz not null default now()
);
create index if not exists raffle_tickets_raffle_idx on public.raffle_tickets (raffle_id, id);
create index if not exists raffle_tickets_user_idx on public.raffle_tickets (raffle_id, user_id);

-- No hidden info (winner drawn at draw time) → world-readable for the live
-- pot / participants / past-winners panels.
alter table public.raffles enable row level security;
alter table public.raffle_tickets enable row level security;

drop policy if exists raffles_select_all on public.raffles;
create policy raffles_select_all on public.raffles for select to authenticated using (true);
drop policy if exists raffle_tickets_select_all on public.raffle_tickets;
create policy raffle_tickets_select_all on public.raffle_tickets for select to authenticated using (true);

-- Next Sunday 20:00 UTC, strictly in the future.
create or replace function public.raffle_next_draw()
  returns timestamptz language sql stable as $$
  select case
    when d <= now() then d + interval '7 days'
    else d
  end
  from (select date_trunc('day', now())
               + ((7 - extract(dow from now())::int) % 7) * interval '1 day'
               + interval '20 hours' as d) s;
$$;

-- Open a fresh weekly raffle (fixed price + house seed).
create or replace function public.raffle_open_next()
  returns public.raffles language plpgsql volatile security definer set search_path = public as $$
declare
  v_price bigint := 50;
  v_seed  bigint := 1000;
  v_r public.raffles;
begin
  insert into public.raffles (ticket_price, seed, pot, draws_at)
  values (v_price, v_seed, v_seed, public.raffle_next_draw())
  returning * into v_r;
  return v_r;
end; $$;

-- Draw a raffle: pick the winning ticket (CSPRNG over total_tickets), pay the
-- pot to its owner, mark drawn. Idempotent (no-op if already drawn / not due).
create or replace function public.raffle_draw(p_raffle_id bigint)
  returns void language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_r public.raffles;
  v_win bigint;
  v_acc bigint := 0;
  v_t public.raffle_tickets;
  v_winner uuid;
  v_winner_name text;
  v_balance bigint;
  v_after bigint;
begin
  select * into v_r from public.raffles where id = p_raffle_id for update;
  if not found or v_r.status <> 'open' then return; end if;

  if v_r.total_tickets = 0 then
    update public.raffles set status = 'drawn', drawn_at = now() where id = p_raffle_id;
    return;
  end if;

  -- Winning ticket index in [0, total_tickets); map to its owner by cumulative qty.
  v_win := floor(public.csprng_unit() * v_r.total_tickets)::bigint;
  for v_t in select * from public.raffle_tickets where raffle_id = p_raffle_id order by id loop
    v_acc := v_acc + v_t.qty;
    if v_win < v_acc then
      v_winner := v_t.user_id;
      v_winner_name := v_t.display_name;
      exit;
    end if;
  end loop;
  if v_winner is null then
    update public.raffles set status = 'drawn', drawn_at = now() where id = p_raffle_id;
    return;
  end if;

  select balance into v_balance from public.profiles where id = v_winner for update;
  v_after := v_balance + v_r.pot;
  if v_after > 1000000000000 then v_after := 1000000000000; end if;
  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (v_winner, 'win', v_after - v_balance, v_after, format('Rifa semanal · %s tós', v_r.pot));
  update public.profiles set balance = v_after where id = v_winner;

  update public.raffles
     set status = 'drawn', drawn_at = now(),
         winner_id = v_winner, winner_name = v_winner_name, winning_ticket = v_win
   where id = p_raffle_id;
end; $$;
revoke all on function public.raffle_draw(bigint) from public;

-- The current open raffle (lazily drawing/rolling over), my ticket count, and
-- recent winners — everything the Rifa page needs in one call.
create or replace function public.raffle_current()
  returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_r public.raffles;
  v_my bigint;
  v_recent jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('arentim_raffle_advance'));

  select * into v_r from public.raffles where status = 'open' order by id desc limit 1;
  if not found then
    v_r := public.raffle_open_next();
  elsif v_r.draws_at <= now() then
    perform public.raffle_draw(v_r.id);
    v_r := public.raffle_open_next();
  end if;

  select coalesce(sum(qty), 0) into v_my
    from public.raffle_tickets where raffle_id = v_r.id and user_id = v_uid;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_recent from (
    select jsonb_build_object(
             'id', r.id, 'pot', r.pot, 'winner_name', r.winner_name,
             'total_tickets', r.total_tickets, 'drawn_at', r.drawn_at) as x
      from public.raffles r
     where r.status = 'drawn'
     order by r.id desc
     limit 5
  ) s;

  return jsonb_build_object(
    'id', v_r.id,
    'ticket_price', v_r.ticket_price,
    'pot', v_r.pot,
    'total_tickets', v_r.total_tickets,
    'draws_at', v_r.draws_at,
    'my_tickets', v_my,
    'recent', v_recent
  );
end; $$;
revoke all on function public.raffle_current() from public;
grant execute on function public.raffle_current() to authenticated;

-- Buy N tickets in the current open raffle (atomic debit + pot/ticket update).
create or replace function public.buy_raffle_tickets(p_qty int)
  returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_r public.raffles;
  v_name text;
  v_cost bigint;
  v_balance bigint;
  v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_qty < 1 or p_qty > 100 then
    raise exception 'invalid quantity' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('arentim_raffle_advance'));

  select * into v_r from public.raffles where status = 'open' order by id desc limit 1;
  if not found or v_r.draws_at <= now() then
    return jsonb_build_object('status', 'closed');
  end if;

  v_cost := v_r.ticket_price * p_qty;

  select balance, display_name into v_balance, v_name from public.profiles where id = v_uid for update;
  if v_balance < v_cost then
    return jsonb_build_object('status', 'insufficient', 'balance', v_balance, 'cost', v_cost);
  end if;
  v_after := v_balance - v_cost;

  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'raffle', -v_cost, v_after, format('Rifa · %s bilhete(s)', p_qty));
  update public.profiles set balance = v_after where id = v_uid;

  insert into public.raffle_tickets (raffle_id, user_id, display_name, qty)
  values (v_r.id, v_uid, v_name, p_qty);
  update public.raffles
     set total_tickets = total_tickets + p_qty,
         pot = pot + v_cost
   where id = v_r.id;

  return jsonb_build_object('status', 'bought', 'qty', p_qty, 'cost', v_cost, 'balance', v_after);
end; $$;
revoke all on function public.buy_raffle_tickets(int) from public;
grant execute on function public.buy_raffle_tickets(int) to authenticated;
