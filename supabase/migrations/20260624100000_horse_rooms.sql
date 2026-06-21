-- ============================================================================
-- Arentim — Corrida de Cavalos as a SHARED LIVE ROOM (like Crash/Roulette).
-- One global race everyone watches in sync:
--   betting (12s) → racing (6s) → done/cooldown (6s) → next.
-- Lazy, advisory-locked progression via horse_room_now() — no cron. The winner
-- is drawn at room creation (weighted by 1/odds → ~0.95 RTP per horse) and kept
-- HIDDEN until betting closes (the rooms table has no client SELECT policy).
-- Odds [2.4,4,6,9,14,28]; weights round(10000/odds) (Σ 10516).
-- ============================================================================

create table if not exists public.horse_rooms (
  id              bigint generated always as identity primary key,
  status          text not null default 'betting' check (status in ('betting', 'racing', 'done')),
  winner          int not null,
  betting_ends_at timestamptz not null,
  race_start_at   timestamptz not null,
  finish_at       timestamptz not null,
  created_at      timestamptz not null default now(),
  ended_at        timestamptz
);
create index if not exists horse_rooms_recent_idx on public.horse_rooms (id desc);
alter table public.horse_rooms enable row level security;  -- winner hidden, no select policy

create table if not exists public.horse_bets (
  id           bigint generated always as identity primary key,
  room_id      bigint not null references public.horse_rooms (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  horse        int not null check (horse between 0 and 5),
  stake        bigint not null check (stake > 0),
  payout       bigint not null default 0,
  settled      boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (room_id, user_id)
);
create index if not exists horse_bets_room_idx on public.horse_bets (room_id, id);
alter table public.horse_bets enable row level security;
drop policy if exists horse_bets_select_all on public.horse_bets;
create policy horse_bets_select_all on public.horse_bets for select to authenticated using (true);

-- ---- settle every bet against the room's winner --------------------------
create or replace function public.horse_settle_room(p_room_id bigint)
  returns void language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_odds numeric[] := array[2.4, 4, 6, 9, 14, 28];
  v_winner int; v_bet public.horse_bets; v_payout bigint; v_after bigint;
begin
  select winner into v_winner from public.horse_rooms where id = p_room_id;
  if v_winner is null then return; end if;
  for v_bet in select * from public.horse_bets where room_id = p_room_id and not settled for update loop
    if v_bet.horse = v_winner then
      v_payout := floor(v_bet.stake * v_odds[v_bet.horse + 1]);
      update public.horse_bets set settled = true, payout = v_payout where id = v_bet.id;
      select balance into v_after from public.profiles where id = v_bet.user_id for update;
      v_after := v_after + v_payout;
      insert into public.transactions (user_id, type, game, amount, balance_after, note)
      values (v_bet.user_id, 'win', 'horse', v_payout, v_after, format('corrida — cavalo %s', v_winner + 1));
      update public.profiles set balance = v_after, total_won = total_won + v_payout,
             games_won = games_won + 1, biggest_win = greatest(biggest_win, v_payout) where id = v_bet.user_id;
    else
      update public.horse_bets set settled = true, payout = 0 where id = v_bet.id;
    end if;
    insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
    values (v_bet.user_id, 'horse', v_bet.stake, (case when v_bet.horse = v_winner then floor(v_bet.stake * v_odds[v_bet.horse + 1]) else 0 end),
            jsonb_build_object('winner', v_winner, 'horse', v_bet.horse), jsonb_build_object('odds', v_odds[v_bet.horse + 1]));
  end loop;
end; $$;
revoke all on function public.horse_settle_room(bigint) from public;

-- ---- advance the shared timeline (lock-serialized) -----------------------
create or replace function public.horse_advance()
  returns public.horse_rooms language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_room public.horse_rooms; v_now timestamptz := now();
  v_weights int[] := array[4167, 2500, 1667, 1111, 714, 357]; v_total int := 10516;
  v_r int; v_acc int := 0; v_winner int := 0; v_i int;
begin
  perform pg_advisory_xact_lock(hashtext('horse_room'));
  select * into v_room from public.horse_rooms order by id desc limit 1;

  if found then
    if v_room.status <> 'done' and v_now >= v_room.finish_at then
      update public.horse_rooms set status = 'done', ended_at = v_room.finish_at where id = v_room.id;
      v_room.status := 'done'; v_room.ended_at := v_room.finish_at;
      perform public.horse_settle_room(v_room.id);
    elsif v_room.status = 'betting' and v_now >= v_room.betting_ends_at then
      update public.horse_rooms set status = 'racing' where id = v_room.id;
      v_room.status := 'racing';
    end if;
  end if;

  if not found or (v_room.status = 'done' and v_now >= v_room.finish_at + interval '6 seconds') then
    v_r := public.csprng_below(v_total);
    for v_i in 1..6 loop
      v_acc := v_acc + v_weights[v_i];
      if v_r < v_acc then v_winner := v_i - 1; exit; end if;
    end loop;
    insert into public.horse_rooms (status, winner, betting_ends_at, race_start_at, finish_at)
    values ('betting', v_winner,
            v_now + interval '12 seconds',
            v_now + interval '12 seconds',
            v_now + interval '12 seconds' + interval '6 seconds')
    returning * into v_room;
  end if;

  return v_room;
end; $$;
revoke all on function public.horse_advance() from public;

-- ---- public, masked snapshot --------------------------------------------
create or replace function public.horse_room_now()
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare v_room public.horse_rooms; v_uid uuid := auth.uid(); v_mine public.horse_bets;
begin
  v_room := public.horse_advance();
  if v_uid is not null then
    select * into v_mine from public.horse_bets where room_id = v_room.id and user_id = v_uid;
  end if;
  return jsonb_build_object(
    'room_id', v_room.id, 'status', v_room.status, 'server_now', now(),
    'betting_ends_at', v_room.betting_ends_at, 'race_start_at', v_room.race_start_at,
    'finish_at', v_room.finish_at,
    'odds', to_jsonb(array[2.4, 4, 6, 9, 14, 28]),
    -- winner hidden until betting closes (racing/done)
    'winner', case when v_room.status in ('racing', 'done') then v_room.winner else null end,
    'mine', case when v_mine.id is not null then jsonb_build_object('horse', v_mine.horse, 'stake', v_mine.stake, 'settled', v_mine.settled, 'payout', v_mine.payout) else null end
  );
end; $$;
revoke all on function public.horse_room_now() from public;
grant execute on function public.horse_room_now() to authenticated;

-- ---- place a bet (betting window only) -----------------------------------
create or replace function public.horse_room_bet(p_room_id bigint, p_horse int, p_stake bigint)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare v_uid uuid := auth.uid(); v_room public.horse_rooms; v_balance bigint; v_after bigint; v_name text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_horse is null or p_horse < 0 or p_horse > 5 then raise exception 'invalid horse' using errcode = 'check_violation'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then raise exception 'invalid stake' using errcode = 'check_violation'; end if;

  perform pg_advisory_xact_lock(hashtext('horse_room'));
  select * into v_room from public.horse_rooms where id = p_room_id;
  if not found then raise exception 'no such race' using errcode = 'check_violation'; end if;
  if now() >= v_room.betting_ends_at then raise exception 'apostas fechadas' using errcode = 'check_violation'; end if;
  if exists (select 1 from public.horse_bets where room_id = p_room_id and user_id = v_uid) then
    raise exception 'já apostaste nesta corrida' using errcode = 'check_violation';
  end if;

  select balance, display_name into v_balance, v_name from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;
  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'horse', -p_stake, v_after, 'corrida sala');
  update public.profiles set balance = v_after, total_wagered = total_wagered + p_stake, total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date where id = v_uid;
  insert into public.horse_bets (room_id, user_id, display_name, horse, stake) values (p_room_id, v_uid, v_name, p_horse, p_stake);
  return jsonb_build_object('ok', true, 'balance', v_after);
end; $$;
revoke all on function public.horse_room_bet(bigint, int, bigint) from public;
grant execute on function public.horse_room_bet(bigint, int, bigint) to authenticated;

-- ---- recent winners -------------------------------------------------------
create or replace function public.horse_room_history()
  returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(winner order by id desc), '[]'::jsonb)
  from (select id, winner from public.horse_rooms where status = 'done' order by id desc limit 12) q;
$$;
revoke all on function public.horse_room_history() from public;
grant execute on function public.horse_room_history() to authenticated;

-- ---- realtime: stream bets for the live ticker ----------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'horse_bets') then
    alter publication supabase_realtime add table public.horse_bets;
  end if;
end $$;
