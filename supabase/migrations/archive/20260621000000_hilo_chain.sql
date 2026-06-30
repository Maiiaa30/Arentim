-- ============================================================================
-- Arentim — Sobe e Desce now chains: the drawn number becomes the next round's
-- starting number (instead of dealing a fresh random and leaving a window where
-- the round was already consumed → "deal a number first" after round 1).
--
-- hilo_bet keeps the round row and updates current_n to the number it drew, so
-- there is always a current number to bet against and each round starts where
-- the last one landed.
-- ============================================================================

create or replace function public.hilo_bet(p_stake bigint, p_pick text)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_n int; v_m int; v_count int;
  v_mult numeric; v_payout bigint := 0; v_win boolean;
  v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_pick not in ('sobe', 'desce') then raise exception 'invalid pick' using errcode = 'check_violation'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  -- Lock the dealt number (serialises rapid bets; the round persists).
  select current_n into v_n from public.hilo_rounds where user_id = v_uid for update;
  if v_n is null then raise exception 'deal a number first' using errcode = 'check_violation'; end if;

  v_count := case when p_pick = 'sobe' then 13 - v_n else v_n - 1 end;
  if v_count = 0 then raise exception 'that side is impossible on this number' using errcode = 'check_violation'; end if;
  v_mult := public.hilo_mult(v_count);

  -- Next number from the 12 rungs other than N.
  v_m := public.csprng_below(12) + 1;
  if v_m >= v_n then v_m := v_m + 1; end if;

  v_win := (p_pick = 'sobe' and v_m > v_n) or (p_pick = 'desce' and v_m < v_n);

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'sobedesce', -p_stake, v_after, format('sobe e desce de %s', v_n));

  if v_win then
    v_payout := floor(p_stake * v_mult);
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'sobedesce', v_payout, v_after, format('%s->%s', v_n, v_m));
  end if;

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
         total_lost = total_lost + p_stake, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_win then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  -- Chain: the drawn number becomes the next round's starting number.
  update public.hilo_rounds set current_n = v_m, created_at = now() where user_id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
  values (v_uid, 'sobedesce', p_stake, v_payout,
          jsonb_build_object('current', v_n, 'next', v_m, 'pick', p_pick),
          jsonb_build_object('multiplier', v_mult));

  return jsonb_build_object('current', v_n, 'next', v_m, 'won', v_win, 'mult', v_mult,
                            'payout', v_payout, 'balance', v_after);
end;
$$;
revoke all on function public.hilo_bet(bigint, text) from public;
grant execute on function public.hilo_bet(bigint, text) to authenticated;
