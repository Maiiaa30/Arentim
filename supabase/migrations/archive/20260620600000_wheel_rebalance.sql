-- ============================================================================
-- Arentim — rebalance the Roda da Sorte wheel so it feels less empty.
-- Old: 15 of 24 segments were blanks. New: only 6 blanks, plus 9 half-backs,
-- 6×1.5, 2×2 and one 5× jackpot. RTP ≈ 0.94 (a ~6% house edge). The arrangement
-- is mirrored in src/features/casino/miniGames.ts (WHEEL) and pinned by a test.
-- ============================================================================

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
  v_wheel numeric[] := array[0.5,1.5,0,0.5,2,0.5,1.5,0,0.5,1.5,0.5,5,0.5,1.5,0,0.5,2,1.5,0.5,0,1.5,0.5,0,0];
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
