-- ============================================================================
-- Arentim — head-to-head friend DUELS. A challenger stakes N tós against a
-- friend; on accept both stakes go into escrow, the server draws a d100 for each
-- (re-rolling ties so there is always a winner), and the winner takes the whole
-- pot. Decline / cancel / expire refunds the challenger. Server-authoritative,
-- advisory-locked, accepted-friends-only. Duel P&L is kept OUT of the lifetime
-- casino aggregates (pure balance moves + ledger rows).
-- ============================================================================

create table if not exists public.duels (
  id              bigint generated always as identity primary key,
  challenger      uuid not null references public.profiles (id) on delete cascade,
  opponent        uuid not null references public.profiles (id) on delete cascade,
  stake           bigint not null check (stake > 0),
  game            text not null default 'd100',
  status          text not null default 'pending'
                    check (status in ('pending', 'settled', 'declined', 'cancelled')),
  challenger_roll int,
  opponent_roll   int,
  winner          uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  settled_at      timestamptz,
  check (challenger <> opponent)
);
create index if not exists duels_parties_idx on public.duels (challenger, opponent, id desc);
create index if not exists duels_opponent_pending_idx on public.duels (opponent) where status = 'pending';

alter table public.duels enable row level security;
drop policy if exists duels_select_party on public.duels;
create policy duels_select_party on public.duels
  for select to authenticated using (challenger = auth.uid() or opponent = auth.uid());

-- ---- Create a challenge (debits the challenger into escrow) -----------------
create or replace function public.duel_create(p_opponent uuid, p_stake bigint, p_game text default 'd100')
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint; v_after bigint; v_name text; v_duel bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_opponent = v_uid then raise exception 'não te podes desafiar' using errcode = 'check_violation'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000 then
    raise exception 'aposta inválida' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.friendships
     where status = 'accepted'
       and ((requester = v_uid and addressee = p_opponent) or (requester = p_opponent and addressee = v_uid))
  ) then
    raise exception 'só podes desafiar amigos' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('duel'));

  if exists (
    select 1 from public.duels
     where status = 'pending'
       and ((challenger = v_uid and opponent = p_opponent) or (challenger = p_opponent and opponent = v_uid))
  ) then
    raise exception 'já existe um duelo pendente com este amigo' using errcode = 'check_violation';
  end if;

  select balance, display_name into v_balance, v_name from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'duel', -p_stake, v_after, 'duelo — aposta');
  update public.profiles set balance = v_after where id = v_uid;

  insert into public.duels (challenger, opponent, stake, game)
  values (v_uid, p_opponent, p_stake, coalesce(nullif(p_game, ''), 'd100'))
  returning id into v_duel;

  insert into public.notifications (user_id, type, title, body, link, data)
  values (p_opponent, 'duel', 'Foste desafiado!',
          coalesce(v_name, 'Um amigo') || ' desafiou-te para um duelo de ' || p_stake || ' tós', '/friends',
          jsonb_build_object('duel_id', v_duel, 'from', v_uid, 'stake', p_stake));

  return jsonb_build_object('duel_id', v_duel, 'balance', v_after);
end; $$;
revoke all on function public.duel_create(uuid, bigint, text) from public;
grant execute on function public.duel_create(uuid, bigint, text) to authenticated;

-- ---- Respond: accept (play it out) or decline (refund challenger) -----------
create or replace function public.duel_respond(p_duel_id bigint, p_accept boolean)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_d public.duels;
  v_balance bigint; v_after bigint;
  v_c int; v_o int; v_winner uuid; v_loser uuid;
  v_opp_name text; v_chal_name text; v_pot bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('duel'));
  select * into v_d from public.duels where id = p_duel_id and opponent = v_uid and status = 'pending' for update;
  if not found then raise exception 'duelo não disponível' using errcode = 'check_violation'; end if;

  select display_name into v_opp_name from public.profiles where id = v_uid;
  select display_name into v_chal_name from public.profiles where id = v_d.challenger;

  if not p_accept then
    update public.duels set status = 'declined', settled_at = now() where id = v_d.id;
    -- Refund the challenger's escrow.
    select balance into v_balance from public.profiles where id = v_d.challenger for update;
    v_after := v_balance + v_d.stake;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_d.challenger, 'refund', 'duel', v_d.stake, v_after, 'duelo recusado');
    update public.profiles set balance = v_after where id = v_d.challenger;
    insert into public.notifications (user_id, type, title, body, link, data)
    values (v_d.challenger, 'duel_result', 'Duelo recusado',
            coalesce(v_opp_name, 'O teu amigo') || ' recusou o duelo. Aposta devolvida.', '/friends',
            jsonb_build_object('duel_id', v_d.id));
    return jsonb_build_object('status', 'declined');
  end if;

  -- Accept → take the opponent's stake into escrow.
  select balance into v_balance from public.profiles where id = v_uid for update;
  if v_balance < v_d.stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;
  v_after := v_balance - v_d.stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'duel', -v_d.stake, v_after, 'duelo — aposta');
  update public.profiles set balance = v_after where id = v_uid;

  -- Draw d100 for each, re-rolling ties so there is always a winner.
  loop
    v_c := floor(public.csprng_unit() * 100)::int + 1;
    v_o := floor(public.csprng_unit() * 100)::int + 1;
    exit when v_c <> v_o;
  end loop;
  if v_c > v_o then v_winner := v_d.challenger; v_loser := v_d.opponent;
  else v_winner := v_d.opponent; v_loser := v_d.challenger; end if;
  v_pot := v_d.stake * 2;

  update public.duels
     set status = 'settled', challenger_roll = v_c, opponent_roll = v_o, winner = v_winner, settled_at = now()
   where id = v_d.id;

  -- Winner takes the whole pot.
  select balance into v_balance from public.profiles where id = v_winner for update;
  v_after := v_balance + v_pot;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_winner, 'win', 'duel', v_pot, v_after, format('duelo ganho %s–%s', greatest(v_c, v_o), least(v_c, v_o)));
  update public.profiles set balance = v_after, biggest_win = greatest(biggest_win, v_pot) where id = v_winner;

  insert into public.notifications (user_id, type, title, body, link, data)
  values
    (v_winner, 'duel_result', 'Ganhaste o duelo! 🏆',
     'Ganhaste ' || v_pot || ' tós no duelo.', '/friends',
     jsonb_build_object('duel_id', v_d.id, 'won', true, 'pot', v_pot)),
    (v_loser, 'duel_result', 'Perdeste o duelo',
     'Ficaste a ' || (case when v_loser = v_d.challenger then v_c else v_o end)
       || ' contra ' || (case when v_loser = v_d.challenger then v_o else v_c end) || '.', '/friends',
     jsonb_build_object('duel_id', v_d.id, 'won', false));

  return jsonb_build_object('status', 'settled', 'challenger_roll', v_c, 'opponent_roll', v_o,
                            'winner', v_winner, 'won', v_winner = v_uid, 'balance',
                            (select balance from public.profiles where id = v_uid));
end; $$;
revoke all on function public.duel_respond(bigint, boolean) from public;
grant execute on function public.duel_respond(bigint, boolean) to authenticated;

-- ---- Cancel a pending duel you sent (refund) -------------------------------
create or replace function public.duel_cancel(p_duel_id bigint)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_d public.duels; v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('duel'));
  select * into v_d from public.duels where id = p_duel_id and challenger = v_uid and status = 'pending' for update;
  if not found then raise exception 'duelo não disponível' using errcode = 'check_violation'; end if;
  update public.duels set status = 'cancelled', settled_at = now() where id = v_d.id;
  select balance into v_balance from public.profiles where id = v_uid for update;
  v_after := v_balance + v_d.stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'refund', 'duel', v_d.stake, v_after, 'duelo cancelado');
  update public.profiles set balance = v_after where id = v_uid;
  return jsonb_build_object('balance', v_after);
end; $$;
revoke all on function public.duel_cancel(bigint) from public;
grant execute on function public.duel_cancel(bigint) to authenticated;

-- ---- List my duels (pending both ways + recent settled) --------------------
create or replace function public.duel_list()
  returns table (
    id bigint, role text, other_id uuid, other_name text, stake bigint, game text,
    status text, challenger_roll int, opponent_roll int, winner uuid, my_roll int, their_roll int,
    created_at timestamptz
  )
  language sql stable security definer set search_path = public as $$
  select d.id,
         case when d.challenger = auth.uid() then 'challenger' else 'opponent' end as role,
         case when d.challenger = auth.uid() then d.opponent else d.challenger end as other_id,
         p.display_name as other_name,
         d.stake, d.game, d.status, d.challenger_roll, d.opponent_roll, d.winner,
         case when d.challenger = auth.uid() then d.challenger_roll else d.opponent_roll end as my_roll,
         case when d.challenger = auth.uid() then d.opponent_roll else d.challenger_roll end as their_roll,
         d.created_at
    from public.duels d
    join public.profiles p
      on p.id = case when d.challenger = auth.uid() then d.opponent else d.challenger end
   where d.challenger = auth.uid() or d.opponent = auth.uid()
   order by (d.status = 'pending') desc, d.id desc
   limit 30;
$$;
revoke all on function public.duel_list() from public;
grant execute on function public.duel_list() to authenticated;
