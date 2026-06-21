-- ============================================================================
-- Arentim — four new one-shot mini-games: Dados (dice), Sobe e Desce (hi-lo),
-- Roda da Sorte (lucky wheel) and Crash. Same atomic-settlement pattern as the
-- existing quick games: validate → lock → debit → roll (server CSPRNG) →
-- credit → record, all in one transaction, idempotent. Payout multipliers can be
-- fractional, so payouts are floor(stake * multiplier).
-- ============================================================================

-- A uniform double in [0, 1) from 6 CSPRNG bytes (48-bit). Used by Crash.
create or replace function public.csprng_unit()
  returns double precision
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  g bytea := gen_random_bytes(6);
  n bigint := 0;
  i integer;
begin
  for i in 0..5 loop
    n := n * 256 + get_byte(g, i);
  end loop;
  return n::double precision / 281474976710656.0; -- 2^48
end;
$$;
revoke all on function public.csprng_unit() from public;

-- ----------------------------------------------------------------------------
-- Dados — two dice (2d6). Bet the total is Over 7 (8-12), Under 7 (2-6) or
-- exactly Seven. Over/Under pay 2.3×; Seven pays 5.5×.
-- ----------------------------------------------------------------------------
create or replace function public.play_dice(
  p_stake bigint,
  p_pick text,                          -- 'over' | 'under' | 'seven'
  p_idempotency_key text default null
)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance bigint;
  v_after   bigint;
  v_d1 int; v_d2 int; v_sum int;
  v_mult    numeric := 0;
  v_payout  bigint := 0;
  v_win     boolean := false;
  v_existing public.game_rounds;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_pick not in ('over','under','seven') then
    raise exception 'invalid pick' using errcode = 'check_violation';
  end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'dice', v_existing.outcome -> 'dice', 'sum', (v_existing.outcome ->> 'sum')::int,
        'won', (v_existing.payout > 0), 'payout', v_existing.payout,
        'balance', (select balance from public.profiles where id = v_uid), 'replayed', true);
    end if;
  end if;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'dice', -p_stake, v_after, 'dados');

  v_d1 := public.csprng_below(6) + 1;
  v_d2 := public.csprng_below(6) + 1;
  v_sum := v_d1 + v_d2;

  if    p_pick = 'over'  and v_sum >= 8 then v_win := true; v_mult := 2.3;
  elsif p_pick = 'under' and v_sum <= 6 then v_win := true; v_mult := 2.3;
  elsif p_pick = 'seven' and v_sum  = 7 then v_win := true; v_mult := 5.5;
  end if;
  v_payout := floor(p_stake * v_mult);

  if v_payout > 0 then
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'dice', v_payout, v_after, format('dados %s+%s', v_d1, v_d2));
  end if;

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
         total_lost = total_lost + p_stake, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_win then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'dice', p_stake, v_payout,
          jsonb_build_object('dice', jsonb_build_array(v_d1, v_d2), 'sum', v_sum, 'pick', p_pick),
          jsonb_build_object('multiplier', v_mult), p_idempotency_key);

  return jsonb_build_object('dice', jsonb_build_array(v_d1, v_d2), 'sum', v_sum,
                            'won', v_win, 'payout', v_payout, 'balance', v_after, 'replayed', false);
end;
$$;
revoke all on function public.play_dice(bigint, text, text) from public;
grant execute on function public.play_dice(bigint, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Sobe e Desce — a marker lands on a rung 1..13. Bet it climbs above 7 (Sobe,
-- 8-13), falls below 7 (Desce, 1-6) or stops exactly on 7 (Sete). Sobe/Desce
-- pay 2×; Sete pays 12×.
-- ----------------------------------------------------------------------------
create or replace function public.play_hilo(
  p_stake bigint,
  p_pick text,                          -- 'sobe' | 'desce' | 'sete'
  p_idempotency_key text default null
)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance bigint;
  v_after   bigint;
  v_n int;
  v_mult    numeric := 0;
  v_payout  bigint := 0;
  v_win     boolean := false;
  v_existing public.game_rounds;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_pick not in ('sobe','desce','sete') then
    raise exception 'invalid pick' using errcode = 'check_violation';
  end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'number', (v_existing.outcome ->> 'number')::int, 'won', (v_existing.payout > 0),
        'payout', v_existing.payout,
        'balance', (select balance from public.profiles where id = v_uid), 'replayed', true);
    end if;
  end if;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'sobedesce', -p_stake, v_after, 'sobe e desce');

  v_n := public.csprng_below(13) + 1; -- 1..13

  if    p_pick = 'sobe'  and v_n >= 8 then v_win := true; v_mult := 2.0;
  elsif p_pick = 'desce' and v_n <= 6 then v_win := true; v_mult := 2.0;
  elsif p_pick = 'sete'  and v_n  = 7 then v_win := true; v_mult := 12.0;
  end if;
  v_payout := floor(p_stake * v_mult);

  if v_payout > 0 then
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'sobedesce', v_payout, v_after, format('sobe e desce %s', v_n));
  end if;

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
         total_lost = total_lost + p_stake, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_win then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'sobedesce', p_stake, v_payout,
          jsonb_build_object('number', v_n, 'pick', p_pick),
          jsonb_build_object('multiplier', v_mult), p_idempotency_key);

  return jsonb_build_object('number', v_n, 'won', v_win, 'payout', v_payout,
                            'balance', v_after, 'replayed', false);
end;
$$;
revoke all on function public.play_hilo(bigint, text, text) from public;
grant execute on function public.play_hilo(bigint, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Roda da Sorte — a 24-segment wheel. Each segment is equally likely; segment i
-- pays its multiplier (0 = lose). RTP ≈ 0.93. The arrangement is mirrored in
-- src/features/casino/miniGames.ts (WHEEL) and pinned by a unit test.
-- ----------------------------------------------------------------------------
create or replace function public.play_wheel(
  p_stake bigint,
  p_idempotency_key text default null
)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance bigint;
  v_after   bigint;
  v_wheel numeric[] := array[0,1.2,0,1.5,0,1.2,0,3,0,1.5,0,1.2,0,10,0,1.5,0,1.2,0,0,0,0,0,0];
  v_idx int;
  v_mult numeric;
  v_payout  bigint := 0;
  v_existing public.game_rounds;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'index', (v_existing.outcome ->> 'index')::int,
        'multiplier', (v_existing.detail ->> 'multiplier')::numeric, 'payout', v_existing.payout,
        'balance', (select balance from public.profiles where id = v_uid), 'replayed', true);
    end if;
  end if;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'wheel', -p_stake, v_after, 'roda da sorte');

  v_idx := public.csprng_below(24);
  v_mult := v_wheel[v_idx + 1]; -- 1-based array
  v_payout := floor(p_stake * v_mult);

  if v_payout > 0 then
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'wheel', v_payout, v_after, format('roda %sx', v_mult));
  end if;

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
         total_lost = total_lost + p_stake, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_payout > 0 then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'wheel', p_stake, v_payout,
          jsonb_build_object('index', v_idx),
          jsonb_build_object('multiplier', v_mult), p_idempotency_key);

  return jsonb_build_object('index', v_idx, 'multiplier', v_mult, 'payout', v_payout,
                            'balance', v_after, 'replayed', false);
end;
$$;
revoke all on function public.play_wheel(bigint, text) from public;
grant execute on function public.play_wheel(bigint, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Crash — pick an auto-cash-out target (e.g. 2.00×). The server draws a hidden
-- crash point; if the rocket reaches your target before it busts (target ≤
-- crash), you win stake × target, else you lose. Crash point = 0.96 / (1 - u)
-- gives a ~4% house edge; capped at 1000×.
-- ----------------------------------------------------------------------------
create or replace function public.play_crash(
  p_stake bigint,
  p_target double precision,            -- desired cash-out multiplier, ≥ 1.01
  p_idempotency_key text default null
)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance bigint;
  v_after   bigint;
  v_u double precision;
  v_crash double precision;
  v_target numeric;
  v_mult numeric := 0;
  v_payout  bigint := 0;
  v_win boolean := false;
  v_existing public.game_rounds;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;
  if p_target is null or p_target < 1.01 or p_target > 1000 then
    raise exception 'invalid target' using errcode = 'check_violation';
  end if;
  -- Snap the target to 2 decimals so the stored/echoed value is exact.
  v_target := round(p_target::numeric, 2);

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'crash', (v_existing.outcome ->> 'crash')::numeric, 'target', (v_existing.outcome ->> 'target')::numeric,
        'won', (v_existing.payout > 0), 'payout', v_existing.payout,
        'balance', (select balance from public.profiles where id = v_uid), 'replayed', true);
    end if;
  end if;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'crash', -p_stake, v_after, 'crash');

  v_u := public.csprng_unit();
  v_crash := least(1000.0, 0.96 / (1.0 - v_u));
  if v_crash < 1.0 then v_crash := 1.0; end if;
  v_crash := floor(v_crash * 100) / 100.0; -- truncate to 2dp

  if v_target <= v_crash then
    v_win := true; v_mult := v_target; v_payout := floor(p_stake * v_target);
  end if;

  if v_payout > 0 then
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'crash', v_payout, v_after, format('crash %sx', v_target));
  end if;

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
         total_lost = total_lost + p_stake, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_win then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'crash', p_stake, v_payout,
          jsonb_build_object('crash', v_crash, 'target', v_target),
          jsonb_build_object('multiplier', v_mult), p_idempotency_key);

  return jsonb_build_object('crash', v_crash, 'target', v_target, 'won', v_win,
                            'payout', v_payout, 'balance', v_after, 'replayed', false);
end;
$$;
revoke all on function public.play_crash(bigint, double precision, text) from public;
grant execute on function public.play_crash(bigint, double precision, text) to authenticated;
