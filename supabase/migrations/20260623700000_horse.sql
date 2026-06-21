-- ============================================================================
-- Arentim — Corrida de Cavalos. Pick 1 of 6 horses at fixed decimal odds; the
-- server runs the race (winner drawn weighted by 1/odds so favourites win more)
-- and pays stake × odds on your horse. RTP ≈ 0.95 for every horse (the winner
-- weights sum to an overround of 1/0.95, so E = P_h·O_h = 0.95 regardless).
-- Odds:    [2.4, 4, 6, 9, 14, 28]
-- Weights: round(10000/odds) = [4167, 2500, 1667, 1111, 714, 357] (Σ = 10516)
-- ============================================================================

create or replace function public.play_horse(p_stake bigint, p_horse int, p_idempotency_key text default null)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_odds numeric[] := array[2.4, 4, 6, 9, 14, 28];
  v_weights int[] := array[4167, 2500, 1667, 1111, 714, 357];
  v_total int := 10516;
  v_r int; v_acc int := 0; v_winner int := 0; v_i int;
  v_won boolean; v_payout bigint := 0; v_balance bigint; v_after_bet bigint; v_after_win bigint;
  v_existing public.game_rounds;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;
  if p_horse is null or p_horse < 0 or p_horse > 5 then raise exception 'invalid horse' using errcode = 'check_violation'; end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('winner', v_existing.outcome ->> 'winner', 'horse', p_horse,
        'won', v_existing.payout > 0, 'payout', v_existing.payout,
        'balance', (select balance from public.profiles where id = v_uid), 'odds', to_jsonb(v_odds), 'replayed', true);
    end if;
  end if;

  -- Draw the winner by cumulative weight.
  v_r := public.csprng_below(v_total);
  for v_i in 1..6 loop
    v_acc := v_acc + v_weights[v_i];
    if v_r < v_acc then v_winner := v_i - 1; exit; end if;
  end loop;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;
  v_after_bet := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'horse', -p_stake, v_after_bet, 'corrida');

  v_won := (p_horse = v_winner);
  v_payout := case when v_won then floor(p_stake * v_odds[p_horse + 1]) else 0 end;
  v_after_win := v_after_bet + v_payout;
  if v_payout > 0 then
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'horse', v_payout, v_after_win, format('corrida — cavalo %s', v_winner + 1));
  end if;
  update public.profiles
     set balance = v_after_win, total_wagered = total_wagered + p_stake, total_lost = total_lost + p_stake,
         total_won = total_won + v_payout, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_won then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'horse', p_stake, v_payout,
          jsonb_build_object('winner', v_winner, 'horse', p_horse),
          jsonb_build_object('odds', v_odds[p_horse + 1]), p_idempotency_key);

  return jsonb_build_object('winner', v_winner, 'horse', p_horse, 'won', v_won, 'payout', v_payout,
    'odds', to_jsonb(v_odds), 'balance', v_after_win, 'replayed', false);
end; $$;
revoke all on function public.play_horse(bigint, int, text) from public;
grant execute on function public.play_horse(bigint, int, text) to authenticated;
