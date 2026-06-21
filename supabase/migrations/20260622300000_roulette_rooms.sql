-- ============================================================================
-- Arentim — Roulette as a SHARED live table. One global wheel everyone watches:
--   betting (12s) → spinning (5s) → done/cooldown (6s) → next round.
-- Same lazy, advisory-locked progression as Crash (no cron). The winning number
-- is drawn at round creation but HIDDEN until betting closes — once the wheel is
-- spinning there are no more bets, so revealing it then is safe and lets every
-- client animate the same wheel to the same pocket, landing together.
--
-- Settlement reuses the existing helpers spin_roulette / roulette_multiplier /
-- roulette_new_bonus and mirrors play_roulette exactly (split=18x, corner=9x,
-- per-player lucky-number bonus on straights). The old play_roulette RPC stays.
-- ============================================================================

create table if not exists public.roulette_rooms (
  id              bigint generated always as identity primary key,
  status          text not null default 'betting' check (status in ('betting', 'spinning', 'done')),
  result_number   integer not null,
  betting_ends_at timestamptz not null,
  spin_start_at   timestamptz not null,
  reveal_at       timestamptz not null,
  created_at      timestamptz not null default now(),
  ended_at        timestamptz
);
create index if not exists roulette_rooms_recent_idx on public.roulette_rooms (id desc);

-- result_number is hidden during the betting window → NO direct select policy.
alter table public.roulette_rooms enable row level security;

create table if not exists public.roulette_room_bets (
  id           bigint generated always as identity primary key,
  room_id      bigint not null references public.roulette_rooms (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  bets         jsonb not null,
  stake        bigint not null check (stake > 0),
  payout       bigint not null default 0,
  bonus_hit    boolean not null default false,
  settled      boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (room_id, user_id)
);
create index if not exists roulette_room_bets_room_idx on public.roulette_room_bets (room_id, id);

-- Slips carry no hidden info → readable by everyone for the live bet ticker.
alter table public.roulette_room_bets enable row level security;
drop policy if exists roulette_room_bets_select_all on public.roulette_room_bets;
create policy roulette_room_bets_select_all on public.roulette_room_bets
  for select to authenticated using (true);

-- ---- Settle every open slip against the room's number (idempotent) ---------
create or replace function public.roulette_settle_room(p_room_id bigint)
  returns void language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_number int;
  v_bet    public.roulette_room_bets;
  v_b      jsonb;
  v_kind   text;
  v_sel    integer;
  v_nums   jsonb;
  v_mult   integer;
  v_win    bigint;
  v_payout bigint;
  v_after  bigint;
  v_bonus  jsonb;
  v_bn     jsonb;
  v_bm     integer;
  v_hit    boolean;
begin
  select result_number into v_number from public.roulette_rooms where id = p_room_id;
  if v_number is null then return; end if;

  for v_bet in
    select * from public.roulette_room_bets where room_id = p_room_id and not settled for update
  loop
    select roulette_bonus into v_bonus from public.profiles where id = v_bet.user_id for update;
    if v_bonus is null then v_bonus := public.roulette_new_bonus(); end if;
    v_bn := coalesce(v_bonus -> 'numbers', '[]'::jsonb);
    v_bm := coalesce((v_bonus ->> 'mult')::int, 2);
    v_payout := 0; v_hit := false;

    for v_b in select * from jsonb_array_elements(v_bet.bets) loop
      v_kind := v_b ->> 'kind';
      v_sel  := nullif(v_b ->> 'selection', '')::integer;
      if v_kind in ('split', 'corner') then
        v_nums := v_b -> 'numbers';
        if v_nums @> to_jsonb(v_number) then
          v_mult := case when v_kind = 'split' then 18 else 9 end;
        else
          v_mult := 0;
        end if;
      else
        v_mult := public.roulette_multiplier(v_kind, coalesce(v_sel, -1), v_number);
      end if;
      v_win := (v_b ->> 'stake')::bigint * v_mult;
      if v_kind = 'straight' and v_win > 0 and v_bn @> to_jsonb(v_number) then
        v_win := v_win * v_bm;
        v_hit := true;
      end if;
      v_payout := v_payout + v_win;
    end loop;

    update public.roulette_room_bets set settled = true, payout = v_payout, bonus_hit = v_hit
     where id = v_bet.id;

    if v_payout > 0 then
      select balance into v_after from public.profiles where id = v_bet.user_id for update;
      v_after := v_after + v_payout;
      insert into public.transactions (user_id, type, game, amount, balance_after, note)
      values (v_bet.user_id, 'win', 'roulette', v_payout, v_after,
              format('roleta sala %s%s', v_number, case when v_hit then ' BONUS' else '' end));
      update public.profiles
         set balance = v_after, total_won = total_won + v_payout, games_won = games_won + 1,
             biggest_win = greatest(biggest_win, v_payout), roulette_bonus = public.roulette_new_bonus()
       where id = v_bet.user_id;
    else
      update public.profiles set roulette_bonus = public.roulette_new_bonus() where id = v_bet.user_id;
    end if;

    insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
    values (v_bet.user_id, 'roulette', v_bet.stake, v_payout,
            jsonb_build_object('number', v_number,
              'color', case when v_number = 0 then 'green'
                            when public.roulette_is_red(v_number) then 'red' else 'black' end),
            jsonb_build_object('bonus_hit', v_hit));
  end loop;
end; $$;
revoke all on function public.roulette_settle_room(bigint) from public;

-- ---- Advance the shared timeline (lock-serialized) --------------------------
create or replace function public.roulette_advance()
  returns public.roulette_rooms
  language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_room public.roulette_rooms;
  v_now  timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtext('roulette_room'));
  select * into v_room from public.roulette_rooms order by id desc limit 1;

  if found then
    -- Settle + close when the reveal time passes.
    if v_room.status <> 'done' and v_now >= v_room.reveal_at then
      update public.roulette_rooms set status = 'done', ended_at = v_room.reveal_at where id = v_room.id;
      v_room.status := 'done'; v_room.ended_at := v_room.reveal_at;
      perform public.roulette_settle_room(v_room.id);
    elsif v_room.status = 'betting' and v_now >= v_room.betting_ends_at then
      update public.roulette_rooms set status = 'spinning' where id = v_room.id;
      v_room.status := 'spinning';
    end if;
  end if;

  -- Spawn a fresh round if none, or the last one finished its cooldown.
  if not found or (v_room.status = 'done' and v_now >= v_room.reveal_at + interval '6 seconds') then
    insert into public.roulette_rooms (status, result_number, betting_ends_at, spin_start_at, reveal_at)
    values ('betting', public.spin_roulette(),
            v_now + interval '12 seconds',
            v_now + interval '12 seconds',
            v_now + interval '12 seconds' + interval '5 seconds')
    returning * into v_room;
  end if;

  return v_room;
end; $$;
revoke all on function public.roulette_advance() from public;

-- ---- Public, masked snapshot of the current round --------------------------
create or replace function public.roulette_room_now()
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_room public.roulette_rooms;
  v_uid  uuid := auth.uid();
  v_mine public.roulette_room_bets;
begin
  v_room := public.roulette_advance();
  if v_uid is not null then
    select * into v_mine from public.roulette_room_bets where room_id = v_room.id and user_id = v_uid;
  end if;
  return jsonb_build_object(
    'room_id', v_room.id,
    'status', v_room.status,
    'server_now', now(),
    'betting_ends_at', v_room.betting_ends_at,
    'spin_start_at', v_room.spin_start_at,
    'reveal_at', v_room.reveal_at,
    -- Number stays hidden until betting closes (spinning/done).
    'number', case when v_room.status in ('spinning', 'done') then v_room.result_number else null end,
    'bonus', public.roulette_get_bonus(),
    'mine', case when v_mine.id is not null then jsonb_build_object(
        'bets', v_mine.bets, 'stake', v_mine.stake,
        'settled', v_mine.settled, 'payout', v_mine.payout, 'bonus_hit', v_mine.bonus_hit)
      else null end
  );
end; $$;
revoke all on function public.roulette_room_now() from public;
grant execute on function public.roulette_room_now() to authenticated;

-- ---- Place a slip (betting window only) ------------------------------------
-- Validates exactly like play_roulette, debits the total stake, stores the slip;
-- settlement happens against the shared number when the wheel reveals.
create or replace function public.roulette_room_bet(p_room_id bigint, p_bets jsonb)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.roulette_rooms;
  v_bet jsonb; v_kind text; v_selection integer; v_numbers jsonb; v_ncount integer; v_num jsonb;
  v_stake bigint; v_total bigint := 0; v_count integer := 0;
  v_balance bigint; v_after bigint; v_name text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if jsonb_typeof(p_bets) <> 'array' or jsonb_array_length(p_bets) = 0 then
    raise exception 'no bets provided' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_bets) > 50 then
    raise exception 'too many bets' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('roulette_room'));
  select * into v_room from public.roulette_rooms where id = p_room_id;
  if not found then raise exception 'no such round' using errcode = 'check_violation'; end if;
  if now() >= v_room.betting_ends_at then
    raise exception 'apostas fechadas' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.roulette_room_bets where room_id = p_room_id and user_id = v_uid) then
    raise exception 'já apostaste nesta ronda' using errcode = 'check_violation';
  end if;

  -- Validate every bet up front (mirrors play_roulette).
  for v_bet in select * from jsonb_array_elements(p_bets) loop
    v_kind := v_bet ->> 'kind';
    v_stake := (v_bet ->> 'stake')::bigint;
    v_selection := nullif(v_bet ->> 'selection', '')::integer;
    if v_stake is null or v_stake <= 0 or v_stake > 1000000000000 then
      raise exception 'invalid stake' using errcode = 'check_violation';
    end if;
    if v_kind = 'straight' then
      if v_selection is null or v_selection < 0 or v_selection > 36 then
        raise exception 'invalid straight selection' using errcode = 'check_violation';
      end if;
    elsif v_kind in ('split', 'corner') then
      v_numbers := v_bet -> 'numbers';
      if jsonb_typeof(v_numbers) <> 'array' then
        raise exception 'invalid inside bet' using errcode = 'check_violation';
      end if;
      v_ncount := jsonb_array_length(v_numbers);
      if (v_kind = 'split' and v_ncount <> 2) or (v_kind = 'corner' and v_ncount <> 4) then
        raise exception 'invalid inside bet size' using errcode = 'check_violation';
      end if;
      for v_num in select * from jsonb_array_elements(v_numbers) loop
        if (v_num)::int < 0 or (v_num)::int > 36 then
          raise exception 'invalid inside bet number' using errcode = 'check_violation';
        end if;
      end loop;
    else
      perform public.roulette_multiplier(v_kind, coalesce(v_selection, -1), 0);
    end if;
    v_total := v_total + v_stake;
    v_count := v_count + 1;
  end loop;

  select balance, display_name into v_balance, v_name from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < v_total then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - v_total;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'roulette', -v_total, v_after, format('roleta sala %s aposta(s)', v_count));
  update public.profiles
     set balance = v_after, total_wagered = total_wagered + v_total, total_lost = total_lost + v_total,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;
  insert into public.roulette_room_bets (room_id, user_id, display_name, bets, stake)
  values (p_room_id, v_uid, v_name, p_bets, v_total);

  return jsonb_build_object('ok', true, 'balance', v_after, 'stake', v_total);
end; $$;
revoke all on function public.roulette_room_bet(bigint, jsonb) from public;
grant execute on function public.roulette_room_bet(bigint, jsonb) to authenticated;

-- ---- Recent winning numbers for the results strip --------------------------
create or replace function public.roulette_room_history()
  returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(result_number order by id desc), '[]'::jsonb)
  from (select id, result_number from public.roulette_rooms where status = 'done' order by id desc limit 15) q;
$$;
revoke all on function public.roulette_room_history() from public;
grant execute on function public.roulette_room_history() to authenticated;

-- ---- Realtime: stream slip rows so the bet ticker updates live -------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'roulette_room_bets'
     ) then
    alter publication supabase_realtime add table public.roulette_room_bets;
  end if;
end $$;
