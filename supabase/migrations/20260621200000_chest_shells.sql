-- ============================================================================
-- Arentim — Baú do Tesouro becomes a shell/find-the-prize game: a prize hides in
-- one of three chests, they shuffle, and you pick to find it. Server-authoritative
-- prize location (1/3 chance); a correct pick pays 2.85× (RTP ≈ 0.95).
-- ============================================================================

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
  v_prize int; v_win boolean; v_mult numeric := 2.85; v_payout bigint := 0;
  v_existing public.game_rounds;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_pick is null or p_pick < 0 or p_pick > 2 then raise exception 'invalid pick' using errcode = 'check_violation'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('pick', (v_existing.outcome ->> 'pick')::int,
        'prize_index', (v_existing.outcome ->> 'prize')::int, 'won', (v_existing.payout > 0),
        'multiplier', v_mult, 'payout', v_existing.payout,
        'balance', (select balance from public.profiles where id = v_uid), 'replayed', true);
    end if;
  end if;

  v_prize := public.csprng_below(3);
  v_win := (p_pick = v_prize);

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'chest', -p_stake, v_after, 'baú');

  if v_win then
    v_payout := floor(p_stake * v_mult);
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'chest', v_payout, v_after, 'baú encontrado');
  end if;

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
         total_lost = total_lost + p_stake, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_win then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'chest', p_stake, v_payout,
          jsonb_build_object('pick', p_pick, 'prize', v_prize),
          jsonb_build_object('multiplier', v_mult), p_idempotency_key);

  return jsonb_build_object('pick', p_pick, 'prize_index', v_prize, 'won', v_win, 'multiplier', v_mult,
                            'payout', v_payout, 'balance', v_after, 'replayed', false);
end;
$$;
revoke all on function public.play_chest(bigint, int, text) from public;
grant execute on function public.play_chest(bigint, int, text) to authenticated;
