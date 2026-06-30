-- ============================================================================
-- Arentim — Tigrinho is now STINGIER on purpose. The Brazilian joke is that the
-- little tiger never pays, it just eats your money — so drop the line multipliers
-- to land RTP ≈ 0.82 (vs the house ~0.95 elsewhere). High variance, rarely pays.
-- mults [205,82,49,25,15,9] → Σ w³·mult / 21³ = 7603/9261 ≈ 0.821.
-- ============================================================================

create or replace function public.play_tigrinho(p_stake bigint, p_idempotency_key text default null)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_mults int[] := array[205, 82, 49, 25, 15, 9];  -- stingier than before (RTP ≈ 0.82)
  v_grid int[] := '{}'; v_i int; v_r int; v_sym int;
  v_balance bigint; v_after_bet bigint; v_after_win bigint; v_payout bigint := 0; v_line bigint;
  v_wins jsonb := '[]'::jsonb; v_a int; v_existing public.game_rounds;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('grid', v_existing.outcome -> 'grid', 'wins', v_existing.detail -> 'wins',
        'payout', v_existing.payout, 'balance', (select balance from public.profiles where id = v_uid), 'replayed', true);
    end if;
  end if;

  for v_i in 1..9 loop
    v_r := public.csprng_below(21);
    v_sym := case when v_r < 1 then 0 when v_r < 3 then 1 when v_r < 6 then 2
                  when v_r < 10 then 3 when v_r < 15 then 4 else 5 end;
    v_grid := v_grid || v_sym;
  end loop;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;
  v_after_bet := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'tigrinho', -p_stake, v_after_bet, 'tigrinho');

  for v_r in 0..2 loop
    v_a := v_grid[v_r * 3 + 1];
    if v_a = v_grid[v_r * 3 + 2] and v_a = v_grid[v_r * 3 + 3] then
      v_line := floor(v_mults[v_a + 1] * p_stake / 3.0);
      v_payout := v_payout + v_line;
      v_wins := v_wins || jsonb_build_object('row', v_r, 'symbol', v_a, 'amount', v_line);
    end if;
  end loop;

  v_after_win := v_after_bet + v_payout;
  if v_payout > 0 then
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'tigrinho', v_payout, v_after_win, 'tigrinho — linha');
  end if;
  update public.profiles
     set balance = v_after_win, total_wagered = total_wagered + p_stake, total_lost = total_lost + p_stake,
         total_won = total_won + v_payout, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_payout > 0 then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'tigrinho', p_stake, v_payout,
          jsonb_build_object('grid', to_jsonb(v_grid)), jsonb_build_object('wins', v_wins), p_idempotency_key);

  return jsonb_build_object('grid', to_jsonb(v_grid), 'wins', v_wins, 'payout', v_payout,
    'multiplier', round(v_payout::numeric / p_stake, 2), 'balance', v_after_win, 'replayed', false);
end; $$;
revoke all on function public.play_tigrinho(bigint, text) from public;
grant execute on function public.play_tigrinho(bigint, text) to authenticated;
