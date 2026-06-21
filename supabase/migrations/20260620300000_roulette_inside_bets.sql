-- ============================================================================
-- Arentim — roulette inside bets: split (2 numbers) and corner (4 numbers).
--
-- A chip on the line between two numbers is a SPLIT (pays 18x total return); a
-- chip on the cross where four numbers meet is a CORNER (pays 9x). The bet
-- payload carries the covered numbers in a `numbers` array. The PAYOUT depends
-- only on how many numbers are covered (2 or 4), so the maths is fair regardless
-- of adjacency — the UI only offers geometrically-valid spots. play_roulette
-- keeps the lucky-number bonus (straights only) from the previous migration.
-- ============================================================================

create or replace function public.play_roulette(
  p_bets jsonb,
  p_idempotency_key text default null
)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  v_uid         uuid := auth.uid();
  v_bet         jsonb;
  v_kind        text;
  v_selection   integer;
  v_numbers     jsonb;
  v_ncount      integer;
  v_num         jsonb;
  v_stake       bigint;
  v_total_stake bigint := 0;
  v_count       integer := 0;
  v_balance     bigint;
  v_after_bet   bigint;
  v_after_win   bigint;
  v_number      integer;
  v_mult        integer;
  v_win         bigint;
  v_payout      bigint := 0;
  v_results     jsonb := '[]'::jsonb;
  v_round       public.game_rounds;
  v_existing    public.game_rounds;
  v_bonus       jsonb;
  v_bonus_nums  jsonb;
  v_bonus_mult  integer;
  v_bonus_hit   boolean := false;
  v_new_bonus   jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'round_id', v_existing.id, 'number', v_existing.outcome -> 'number',
        'stake', v_existing.stake, 'payout', v_existing.payout,
        'balance', (select balance from public.profiles where id = v_uid),
        'results', coalesce(v_existing.detail -> 'results', '[]'::jsonb),
        'bonus', (select roulette_bonus from public.profiles where id = v_uid),
        'bonus_hit', coalesce((v_existing.detail ->> 'bonus_hit')::boolean, false),
        'replayed', true
      );
    end if;
  end if;

  if jsonb_typeof(p_bets) <> 'array' or jsonb_array_length(p_bets) = 0 then
    raise exception 'no bets provided' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_bets) > 50 then
    raise exception 'too many bets' using errcode = 'check_violation';
  end if;

  -- Validate every bet up front.
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
    v_total_stake := v_total_stake + v_stake;
    v_count := v_count + 1;
  end loop;

  select balance, roulette_bonus into v_balance, v_bonus from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_bonus is null then v_bonus := public.roulette_new_bonus(); end if;
  v_bonus_nums := coalesce(v_bonus -> 'numbers', '[]'::jsonb);
  v_bonus_mult := coalesce((v_bonus ->> 'mult')::int, 2);
  if v_balance < v_total_stake then
    raise exception 'insufficient balance' using errcode = 'check_violation';
  end if;

  v_after_bet := v_balance - v_total_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'roulette', -v_total_stake, v_after_bet, format('%s bet(s)', v_count));

  v_number := public.spin_roulette();

  -- Settle.
  for v_bet in select * from jsonb_array_elements(p_bets) loop
    v_kind := v_bet ->> 'kind';
    v_stake := (v_bet ->> 'stake')::bigint;
    v_selection := nullif(v_bet ->> 'selection', '')::integer;
    if v_kind in ('split', 'corner') then
      v_numbers := v_bet -> 'numbers';
      if v_numbers @> to_jsonb(v_number) then
        v_mult := case when v_kind = 'split' then 18 else 9 end;
      else
        v_mult := 0;
      end if;
    else
      v_mult := public.roulette_multiplier(v_kind, coalesce(v_selection, -1), v_number);
    end if;
    v_win := v_stake * v_mult;
    if v_kind = 'straight' and v_win > 0 and v_bonus_nums @> to_jsonb(v_number) then
      v_win := v_win * v_bonus_mult;
      v_bonus_hit := true;
    end if;
    v_payout := v_payout + v_win;
    v_results := v_results || jsonb_build_object(
      'kind', v_kind, 'selection', v_selection,
      'numbers', case when v_kind in ('split','corner') then v_bet -> 'numbers' else null end,
      'stake', v_stake, 'won', v_win > 0, 'return', v_win
    );
  end loop;

  v_after_win := v_after_bet + v_payout;
  if v_payout > 0 then
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'roulette', v_payout, v_after_win,
            format('roulette landed on %s%s', v_number, case when v_bonus_hit then ' BONUS' else '' end));
  end if;

  v_new_bonus := public.roulette_new_bonus();

  update public.profiles
     set balance        = v_after_win,
         total_wagered  = total_wagered + v_total_stake,
         total_won      = total_won + v_payout,
         total_lost     = total_lost + v_total_stake,
         biggest_win    = greatest(biggest_win, v_payout),
         games_played   = games_played + 1,
         games_won      = games_won + (case when v_payout > 0 then 1 else 0 end),
         last_played_date = current_date,
         roulette_bonus = v_new_bonus
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (
    v_uid, 'roulette', v_total_stake, v_payout,
    jsonb_build_object('number', v_number, 'color',
      case when v_number = 0 then 'green' when public.roulette_is_red(v_number) then 'red' else 'black' end),
    jsonb_build_object('results', v_results, 'bonus_hit', v_bonus_hit), p_idempotency_key
  )
  returning * into v_round;

  return jsonb_build_object(
    'round_id', v_round.id, 'number', v_number, 'stake', v_total_stake,
    'payout', v_payout, 'balance', v_after_win, 'results', v_results,
    'bonus', v_new_bonus, 'bonus_hit', v_bonus_hit, 'replayed', false
  );
end;
$$;
revoke all on function public.play_roulette(jsonb, text) from public;
grant execute on function public.play_roulette(jsonb, text) to authenticated;
