-- ============================================================================
-- Arentim — sportsbook double-debit fix (audit H1).
--
-- place_bet was the one money RPC with no idempotency key: a retried/duplicated
-- call placed a second bet and debited the stake twice. Every casino RPC already
-- dedupes on game_rounds.idempotency_key; bring the sportsbook in line.
--
-- A sequential retry (client saw a network error but the first call committed)
-- hits the replay check at the top and returns the original bet. A truly
-- concurrent duplicate loses the unique-index race and its whole transaction —
-- including the debit — rolls back, so the stake is never charged twice.
-- ============================================================================

alter table public.bets add column if not exists idempotency_key text;
create unique index if not exists bets_idempotency_key_idx
  on public.bets (idempotency_key) where idempotency_key is not null;

drop function if exists public.place_bet(jsonb, bigint);

create or replace function public.place_bet(
  p_selections jsonb, p_stake bigint, p_idempotency_key text default null
)
  returns jsonb language plpgsql volatile
  security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_sel jsonb;
  v_fixture public.fixtures;
  v_market text; v_selection text; v_odds numeric;
  v_combined numeric := 1;
  v_count int := 0;
  v_payout bigint;
  v_balance bigint; v_after bigint;
  v_seen bigint[] := '{}';
  v_bet public.bets;
  v_existing public.bets;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  -- Idempotency replay: a prior identical submission already placed this bet.
  if p_idempotency_key is not null then
    select * into v_existing from public.bets where idempotency_key = p_idempotency_key;
    if found then
      if v_existing.user_id <> v_uid then
        raise exception 'idempotency conflict' using errcode = 'check_violation';
      end if;
      return jsonb_build_object('bet_id', v_existing.id, 'stake', v_existing.stake,
        'combined_odds', v_existing.combined_odds, 'potential_payout', v_existing.potential_payout,
        'balance', (select balance from public.profiles where id = v_uid), 'replayed', true);
    end if;
  end if;

  if jsonb_typeof(p_selections) <> 'array' or jsonb_array_length(p_selections) = 0 then
    raise exception 'no selections' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_selections) > 12 then
    raise exception 'too many selections' using errcode = 'check_violation';
  end if;

  for v_sel in select * from jsonb_array_elements(p_selections) loop
    v_market := v_sel ->> 'market';
    v_selection := v_sel ->> 'selection';

    select * into v_fixture from public.fixtures where id = (v_sel ->> 'fixture_id')::bigint;
    if not found then raise exception 'unknown fixture' using errcode = 'check_violation'; end if;
    if v_fixture.status <> 'scheduled' or v_fixture.kickoff <= now() then
      raise exception 'fixture not open for betting' using errcode = 'check_violation';
    end if;
    if v_fixture.id = any (v_seen) then
      raise exception 'duplicate fixture in parlay' using errcode = 'check_violation';
    end if;
    if not public.fixture_market_valid(v_market, v_selection) then
      raise exception 'invalid market/selection' using errcode = 'check_violation';
    end if;

    v_odds := (v_fixture.odds -> v_market ->> v_selection)::numeric;
    if v_odds is null or v_odds < 1.01 then
      raise exception 'odds unavailable' using errcode = 'check_violation';
    end if;

    v_combined := v_combined * v_odds;
    v_seen := v_seen || v_fixture.id;
    v_count := v_count + 1;
  end loop;

  v_combined := round(v_combined, 4);
  v_payout := floor(p_stake * v_combined);

  select balance into v_balance from public.profiles where id = v_uid for update;
  if v_balance < p_stake then
    raise exception 'insufficient balance' using errcode = 'check_violation';
  end if;
  v_after := v_balance - p_stake;

  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'sportsbook', -p_stake, v_after, format('%s-leg bet', v_count));

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake,
         total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;

  insert into public.bets (user_id, stake, combined_odds, potential_payout, idempotency_key)
  values (v_uid, p_stake, v_combined, v_payout, p_idempotency_key)
  returning * into v_bet;

  for v_sel in select * from jsonb_array_elements(p_selections) loop
    v_market := v_sel ->> 'market';
    v_selection := v_sel ->> 'selection';
    select * into v_fixture from public.fixtures where id = (v_sel ->> 'fixture_id')::bigint;
    v_odds := (v_fixture.odds -> v_market ->> v_selection)::numeric;
    insert into public.bet_selections (bet_id, fixture_id, market, selection, odds)
    values (v_bet.id, v_fixture.id, v_market, v_selection, v_odds);
  end loop;

  return jsonb_build_object('bet_id', v_bet.id, 'stake', p_stake,
    'combined_odds', v_combined, 'potential_payout', v_payout, 'balance', v_after, 'replayed', false);
end; $$;
revoke all on function public.place_bet(jsonb, bigint, text) from public;
grant execute on function public.place_bet(jsonb, bigint, text) to authenticated;
