-- ============================================================================
-- Arentim — Crash as a SHARED live room. Instead of every player drawing their
-- own private rocket, there is ONE global timeline everyone watches:
--   betting (6s) → flying → busted → cooldown (5s) → next round.
-- Rounds advance LAZILY: crash_room_now() (polled ~250ms by whoever is on the
-- page) settles the finished round and spawns the next under an advisory lock —
-- no cron needed. The multiplier is identical for everyone because each client
-- computes it from the same server-stamped fly_start_at + the returned now().
--
-- crash_point is HIDDEN while flying (so is bust_at, which would reveal it). It
-- is only returned once the round has busted. The old per-user crash_* RPCs are
-- left intact and unused.
-- ============================================================================

create table if not exists public.crash_rooms (
  id              bigint generated always as identity primary key,
  status          text not null default 'betting' check (status in ('betting', 'flying', 'busted')),
  crash_point     numeric not null,
  betting_ends_at timestamptz not null,
  fly_start_at    timestamptz not null,
  bust_at         timestamptz not null,
  created_at      timestamptz not null default now(),
  ended_at        timestamptz
);
create index if not exists crash_rooms_recent_idx on public.crash_rooms (id desc);

-- crash_point is hidden info → NO direct select policy. Reads go through
-- crash_room_now(), which masks it. RLS enabled = default deny for clients.
alter table public.crash_rooms enable row level security;

create table if not exists public.crash_bets (
  id           bigint generated always as identity primary key,
  room_id      bigint not null references public.crash_rooms (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  stake        bigint not null check (stake > 0),
  auto_target  numeric,
  cashout      numeric,
  payout       bigint not null default 0,
  settled      boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (room_id, user_id)
);
create index if not exists crash_bets_room_idx on public.crash_bets (room_id, id);

-- Bets carry no hidden info (stake / cashout / name) → readable by everyone so
-- the live "players in this round" panel works and can subscribe via Realtime.
alter table public.crash_bets enable row level security;
drop policy if exists crash_bets_select_all on public.crash_bets;
create policy crash_bets_select_all on public.crash_bets
  for select to authenticated using (true);

-- ---- Settlement of every open bet when a round busts (idempotent) ----------
create or replace function public.crash_settle_room(p_room_id bigint)
  returns void language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_crash numeric;
  v_bet   public.crash_bets;
  v_payout bigint;
  v_after  bigint;
begin
  select crash_point into v_crash from public.crash_rooms where id = p_room_id;
  if v_crash is null then return; end if;

  for v_bet in
    select * from public.crash_bets where room_id = p_room_id and not settled for update
  loop
    if v_bet.auto_target is not null and v_bet.auto_target < v_crash then
      -- Auto cash-out fired before the bust → win.
      v_payout := floor(v_bet.stake * v_bet.auto_target);
      update public.crash_bets set settled = true, cashout = v_bet.auto_target, payout = v_payout
       where id = v_bet.id;
      select balance into v_after from public.profiles where id = v_bet.user_id for update;
      v_after := v_after + v_payout;
      insert into public.transactions (user_id, type, game, amount, balance_after, note)
      values (v_bet.user_id, 'win', 'crash', v_payout, v_after, format('crash auto %sx', v_bet.auto_target));
      update public.profiles
         set balance = v_after, total_won = total_won + v_payout, games_won = games_won + 1,
             biggest_win = greatest(biggest_win, v_payout)
       where id = v_bet.user_id;
      insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
      values (v_bet.user_id, 'crash', v_bet.stake, v_payout,
              jsonb_build_object('crash', v_crash, 'cashout', v_bet.auto_target, 'won', true),
              jsonb_build_object('multiplier', v_bet.auto_target));
    else
      -- Held to the bust (or no auto target) → loss. Stake was already debited.
      update public.crash_bets set settled = true, cashout = v_crash, payout = 0 where id = v_bet.id;
      insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
      values (v_bet.user_id, 'crash', v_bet.stake, 0,
              jsonb_build_object('crash', v_crash, 'cashout', v_crash, 'won', false),
              jsonb_build_object('multiplier', v_crash));
    end if;
  end loop;
end; $$;
revoke all on function public.crash_settle_room(bigint) from public;

-- ---- Advance the shared timeline (lock-serialized) --------------------------
create or replace function public.crash_advance()
  returns public.crash_rooms
  language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_room public.crash_rooms;
  v_now  timestamptz := now();
  v_u    double precision;
  v_crash numeric;
  v_fly_secs double precision;
begin
  perform pg_advisory_xact_lock(hashtext('crash_room'));
  select * into v_room from public.crash_rooms order by id desc limit 1;

  if found then
    -- betting → flying once the window closes.
    if v_room.status = 'betting' and v_now >= v_room.betting_ends_at then
      update public.crash_rooms set status = 'flying' where id = v_room.id;
      v_room.status := 'flying';
    end if;
    -- flying → busted (+ settle) once the bust time passes.
    if v_room.status = 'flying' and v_now >= v_room.bust_at then
      update public.crash_rooms set status = 'busted', ended_at = v_room.bust_at where id = v_room.id;
      v_room.status := 'busted'; v_room.ended_at := v_room.bust_at;
      perform public.crash_settle_room(v_room.id);
    end if;
  end if;

  -- Spawn a fresh round if there is none, or the last one finished its cooldown.
  if not found or (v_room.status = 'busted' and v_now >= v_room.bust_at + interval '5 seconds') then
    v_u := public.csprng_unit();
    v_crash := least(1000.0, 1.0 / (1.0 - v_u));
    if v_crash < 1.0 then v_crash := 1.0; end if;
    v_crash := floor(v_crash * 100) / 100.0;
    v_fly_secs := ln(greatest(v_crash, 1.0001)::double precision) / 0.15;  -- k matches crash_mult
    insert into public.crash_rooms (status, crash_point, betting_ends_at, fly_start_at, bust_at)
    values ('betting', v_crash,
            v_now + interval '6 seconds',
            v_now + interval '6 seconds',
            v_now + interval '6 seconds' + make_interval(secs => v_fly_secs))
    returning * into v_room;
  end if;

  return v_room;
end; $$;
revoke all on function public.crash_advance() from public;

-- ---- Public, masked snapshot of the current round --------------------------
create or replace function public.crash_room_now()
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_room public.crash_rooms;
  v_uid  uuid := auth.uid();
  v_m    numeric;
  v_mine public.crash_bets;
begin
  v_room := public.crash_advance();
  if v_room.status = 'flying' then
    v_m := public.crash_mult(extract(epoch from now() - v_room.fly_start_at));
    if v_m > v_room.crash_point then v_m := v_room.crash_point; end if;
  end if;
  if v_uid is not null then
    select * into v_mine from public.crash_bets where room_id = v_room.id and user_id = v_uid;
  end if;
  return jsonb_build_object(
    'room_id', v_room.id,
    'status', v_room.status,
    'server_now', now(),
    'betting_ends_at', v_room.betting_ends_at,
    'fly_start_at', v_room.fly_start_at,
    -- bust_at would reveal crash_point → only expose once busted.
    'bust_at', case when v_room.status = 'busted' then v_room.bust_at else null end,
    'mult', v_m,
    'crash', case when v_room.status = 'busted' then v_room.crash_point else null end,
    'mine', case when v_mine.id is not null then jsonb_build_object(
        'stake', v_mine.stake, 'auto_target', v_mine.auto_target,
        'settled', v_mine.settled, 'cashout', v_mine.cashout, 'payout', v_mine.payout)
      else null end
  );
end; $$;
revoke all on function public.crash_room_now() from public;
grant execute on function public.crash_room_now() to authenticated;

-- ---- Place a bet (betting window only) -------------------------------------
create or replace function public.crash_room_bet(
  p_room_id bigint, p_stake bigint, p_auto_target double precision default null
)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.crash_rooms;
  v_balance bigint; v_after bigint; v_auto numeric := null; v_name text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;
  if p_auto_target is not null then
    if p_auto_target < 1.01 or p_auto_target > 1000 then
      raise exception 'invalid target' using errcode = 'check_violation';
    end if;
    v_auto := round(p_auto_target::numeric, 2);
  end if;

  perform pg_advisory_xact_lock(hashtext('crash_room'));
  select * into v_room from public.crash_rooms where id = p_room_id;
  if not found then raise exception 'no such round' using errcode = 'check_violation'; end if;
  if now() >= v_room.betting_ends_at then
    raise exception 'apostas fechadas' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.crash_bets where room_id = p_room_id and user_id = v_uid) then
    raise exception 'já entraste nesta ronda' using errcode = 'check_violation';
  end if;

  select balance, display_name into v_balance, v_name from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'crash', -p_stake, v_after, 'crash sala');
  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;
  insert into public.crash_bets (room_id, user_id, display_name, stake, auto_target)
  values (p_room_id, v_uid, v_name, p_stake, v_auto);

  return jsonb_build_object('ok', true, 'balance', v_after);
end; $$;
revoke all on function public.crash_room_bet(bigint, bigint, double precision) from public;
grant execute on function public.crash_room_bet(bigint, bigint, double precision) to authenticated;

-- ---- Manual cash-out (flying only) -----------------------------------------
create or replace function public.crash_room_cashout(p_room_id bigint)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.crash_rooms;
  v_bet  public.crash_bets;
  v_m numeric; v_payout bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('crash_room'));
  select * into v_room from public.crash_rooms where id = p_room_id;
  if not found then raise exception 'no such round' using errcode = 'check_violation'; end if;
  select * into v_bet from public.crash_bets where room_id = p_room_id and user_id = v_uid for update;
  if not found then raise exception 'sem aposta nesta ronda' using errcode = 'check_violation'; end if;

  if v_bet.settled then
    return jsonb_build_object('won', v_bet.payout > 0, 'mult', v_bet.cashout, 'payout', v_bet.payout,
                              'balance', (select balance from public.profiles where id = v_uid), 'replayed', true);
  end if;
  if now() < v_room.fly_start_at then
    raise exception 'a ronda ainda não começou' using errcode = 'check_violation';
  end if;

  v_m := public.crash_mult(extract(epoch from now() - v_room.fly_start_at));
  if now() >= v_room.bust_at or v_m >= v_room.crash_point then
    -- Too late — the rocket already burst.
    update public.crash_bets set settled = true, cashout = v_room.crash_point, payout = 0 where id = v_bet.id;
    insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
    values (v_uid, 'crash', v_bet.stake, 0,
            jsonb_build_object('crash', v_room.crash_point, 'cashout', v_room.crash_point, 'won', false),
            jsonb_build_object('multiplier', v_room.crash_point));
    return jsonb_build_object('won', false, 'mult', v_room.crash_point, 'crash', v_room.crash_point,
                              'payout', 0, 'balance', (select balance from public.profiles where id = v_uid));
  end if;

  v_payout := floor(v_bet.stake * v_m);
  update public.crash_bets set settled = true, cashout = v_m, payout = v_payout where id = v_bet.id;
  select balance into v_after from public.profiles where id = v_uid for update;
  v_after := v_after + v_payout;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'win', 'crash', v_payout, v_after, format('crash %sx', v_m));
  update public.profiles
     set balance = v_after, total_won = total_won + v_payout, games_won = games_won + 1,
         biggest_win = greatest(biggest_win, v_payout)
   where id = v_uid;
  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
  values (v_uid, 'crash', v_bet.stake, v_payout,
          jsonb_build_object('crash', v_room.crash_point, 'cashout', v_m, 'won', true),
          jsonb_build_object('multiplier', v_m));
  -- crash_point omitted from a winning reply so a cashed-out viewer can't learn
  -- the bust point of the still-running round.
  return jsonb_build_object('won', true, 'mult', v_m, 'crash', null, 'payout', v_payout, 'balance', v_after);
end; $$;
revoke all on function public.crash_room_cashout(bigint) from public;
grant execute on function public.crash_room_cashout(bigint) to authenticated;

-- ---- Recent busts for the history strip ------------------------------------
create or replace function public.crash_room_history()
  returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(crash_point order by id desc), '[]'::jsonb)
  from (select id, crash_point from public.crash_rooms where status = 'busted' order by id desc limit 15) q;
$$;
revoke all on function public.crash_room_history() from public;
grant execute on function public.crash_room_history() to authenticated;

-- ---- Realtime: stream bet rows so the players panel updates live -----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crash_bets'
     ) then
    alter publication supabase_realtime add table public.crash_bets;
  end if;
end $$;
