-- ============================================================================
-- Arentim — two more one-shot games: Baú do Tesouro (treasure chest picker) and
-- Maior ou Menor (single-die High/Low). Same atomic-settlement pattern.
-- ============================================================================

-- ---- Baú do Tesouro ---------------------------------------------------------
-- 9 chests hold a shuffled set of multipliers (mostly empty, one 5×). Pick one;
-- you win its multiplier. RTP ≈ 0.94. The value set is mirrored in
-- src/features/casino/miniGames.ts (CHEST_VALUES).
create or replace function public.play_chest(
  p_stake bigint,
  p_pick int,
  p_idempotency_key text default null
)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint; v_after bigint;
  v_vals numeric[] := array[0,0,0,0,0.5,0.5,1,1.5,5];
  v_i int; v_j int; v_tmp numeric;
  v_mult numeric; v_payout bigint := 0;
  v_existing public.game_rounds;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_pick is null or p_pick < 0 or p_pick > 8 then raise exception 'invalid pick' using errcode = 'check_violation'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('index', (v_existing.outcome ->> 'index')::int,
        'multiplier', (v_existing.detail ->> 'multiplier')::numeric, 'layout', v_existing.outcome -> 'layout',
        'payout', v_existing.payout, 'balance', (select balance from public.profiles where id = v_uid), 'replayed', true);
    end if;
  end if;

  -- Fisher–Yates shuffle of the chest values (CSPRNG).
  for v_i in reverse 9..2 loop
    v_j := public.csprng_below(v_i) + 1;
    v_tmp := v_vals[v_i]; v_vals[v_i] := v_vals[v_j]; v_vals[v_j] := v_tmp;
  end loop;
  v_mult := v_vals[p_pick + 1];

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'chest', -p_stake, v_after, 'baú');

  v_payout := floor(p_stake * v_mult);
  if v_payout > 0 then
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'chest', v_payout, v_after, format('baú %sx', v_mult));
  end if;

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
         total_lost = total_lost + p_stake, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_payout > 0 then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'chest', p_stake, v_payout,
          jsonb_build_object('index', p_pick, 'layout', to_jsonb(v_vals)),
          jsonb_build_object('multiplier', v_mult), p_idempotency_key);

  return jsonb_build_object('index', p_pick, 'multiplier', v_mult, 'layout', to_jsonb(v_vals),
                            'payout', v_payout, 'balance', v_after, 'replayed', false);
end;
$$;
revoke all on function public.play_chest(bigint, int, text) from public;
grant execute on function public.play_chest(bigint, int, text) to authenticated;

-- ---- Maior ou Menor (single die High/Low) -----------------------------------
-- Bet High (4-6) or Low (1-3) at 1.9×, or an exact number 1-6 at 5.7×. RTP ≈ 0.95.
create or replace function public.play_highlow(
  p_stake bigint,
  p_pick text,                          -- 'high' | 'low' | '1'..'6'
  p_idempotency_key text default null
)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint; v_after bigint;
  v_die int; v_mult numeric := 0; v_payout bigint := 0; v_win boolean := false;
  v_existing public.game_rounds;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_pick not in ('high','low','1','2','3','4','5','6') then
    raise exception 'invalid pick' using errcode = 'check_violation';
  end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('die', (v_existing.outcome ->> 'die')::int, 'won', (v_existing.payout > 0),
        'payout', v_existing.payout, 'balance', (select balance from public.profiles where id = v_uid), 'replayed', true);
    end if;
  end if;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'highlow', -p_stake, v_after, 'maior ou menor');

  v_die := public.csprng_below(6) + 1;
  if    p_pick = 'high' and v_die >= 4 then v_win := true; v_mult := 1.9;
  elsif p_pick = 'low'  and v_die <= 3 then v_win := true; v_mult := 1.9;
  elsif p_pick ~ '^[1-6]$' and v_die = p_pick::int then v_win := true; v_mult := 5.7;
  end if;
  v_payout := floor(p_stake * v_mult);

  if v_payout > 0 then
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'highlow', v_payout, v_after, format('saiu %s', v_die));
  end if;

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
         total_lost = total_lost + p_stake, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_win then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'highlow', p_stake, v_payout,
          jsonb_build_object('die', v_die, 'pick', p_pick),
          jsonb_build_object('multiplier', v_mult), p_idempotency_key);

  return jsonb_build_object('die', v_die, 'won', v_win, 'payout', v_payout, 'balance', v_after, 'replayed', false);
end;
$$;
revoke all on function public.play_highlow(bigint, text, text) from public;
grant execute on function public.play_highlow(bigint, text, text) to authenticated;
