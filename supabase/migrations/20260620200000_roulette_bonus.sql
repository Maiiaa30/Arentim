-- ============================================================================
-- Arentim — roulette "lucky numbers" bonus mini-game.
--
-- Each round the server picks 3 random bonus numbers shown to the player BEFORE
-- they bet. If a straight-up bet lands on a bonus number, that bet pays DOUBLE
-- (the normal 36x becomes 72x). The bonus is re-rolled after every spin, server-
-- side (CSPRNG), so it can't be gamed. Numbers are stored per-player so they're
-- committed before betting.
-- ============================================================================

alter table public.profiles add column if not exists roulette_bonus jsonb;

-- Roll a fresh set of 3 distinct bonus numbers (+ the bonus multiple).
create or replace function public.roulette_new_bonus()
  returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare a int; b int; c int;
begin
  a := public.spin_roulette();
  loop b := public.spin_roulette(); exit when b <> a; end loop;
  loop c := public.spin_roulette(); exit when c <> a and c <> b; end loop;
  return jsonb_build_object('numbers', jsonb_build_array(a, b, c), 'mult', 2);
end; $$;
revoke all on function public.roulette_new_bonus() from public;

-- Current bonus for the caller (rolls one the first time). Called on page open.
create or replace function public.roulette_get_bonus()
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select roulette_bonus into v from public.profiles where id = auth.uid();
  if v is null then
    v := public.roulette_new_bonus();
    update public.profiles set roulette_bonus = v where id = auth.uid();
  end if;
  return v;
end; $$;
revoke all on function public.roulette_get_bonus() from public;
grant execute on function public.roulette_get_bonus() to authenticated;

-- ---- play_roulette — now applies the lucky-number bonus + re-rolls it --------
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
        'round_id', v_existing.id,
        'number', v_existing.outcome -> 'number',
        'stake', v_existing.stake,
        'payout', v_existing.payout,
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

  for v_bet in select * from jsonb_array_elements(p_bets) loop
    v_kind := v_bet ->> 'kind';
    v_stake := (v_bet ->> 'stake')::bigint;
    v_selection := nullif(v_bet ->> 'selection', '')::integer;
    if v_stake is null or v_stake <= 0 or v_stake > 1000000000000 then
      raise exception 'invalid stake' using errcode = 'check_violation';
    end if;
    if v_kind = 'straight' and (v_selection is null or v_selection < 0 or v_selection > 36) then
      raise exception 'invalid straight selection' using errcode = 'check_violation';
    end if;
    perform public.roulette_multiplier(v_kind, coalesce(v_selection, -1), 0);
    v_total_stake := v_total_stake + v_stake;
    v_count := v_count + 1;
  end loop;

  -- Lock + read balance, and read the committed bonus for this round.
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

  for v_bet in select * from jsonb_array_elements(p_bets) loop
    v_kind := v_bet ->> 'kind';
    v_stake := (v_bet ->> 'stake')::bigint;
    v_selection := nullif(v_bet ->> 'selection', '')::integer;
    v_mult := public.roulette_multiplier(v_kind, coalesce(v_selection, -1), v_number);
    v_win := v_stake * v_mult;
    -- Lucky-number bonus: a winning straight on a bonus number pays double.
    if v_kind = 'straight' and v_win > 0 and v_bonus_nums @> to_jsonb(v_number) then
      v_win := v_win * v_bonus_mult;
      v_bonus_hit := true;
    end if;
    v_payout := v_payout + v_win;
    v_results := v_results || jsonb_build_object(
      'kind', v_kind, 'selection', v_selection, 'stake', v_stake, 'won', v_win > 0, 'return', v_win
    );
  end loop;

  v_after_win := v_after_bet + v_payout;
  if v_payout > 0 then
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'roulette', v_payout, v_after_win,
            format('roulette landed on %s%s', v_number, case when v_bonus_hit then ' BONUS' else '' end));
  end if;

  -- Re-roll the bonus for the next round.
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
    'round_id', v_round.id,
    'number', v_number,
    'stake', v_total_stake,
    'payout', v_payout,
    'balance', v_after_win,
    'results', v_results,
    'bonus', v_new_bonus,
    'bonus_hit', v_bonus_hit,
    'replayed', false
  );
end;
$$;
revoke all on function public.play_roulette(jsonb, text) from public;
grant execute on function public.play_roulette(jsonb, text) to authenticated;
