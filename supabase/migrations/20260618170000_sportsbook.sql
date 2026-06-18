-- ============================================================================
-- Arentim — Phase 6a: Sportsbook core (fixtures, bets, settlement).
--
-- Bets settle from server-held data only: place_bet re-reads the odds from the
-- fixtures table (never trusts client-supplied odds), and settlement re-derives
-- every outcome from the final score. Money moves atomically; a parlay pays out
-- at most once. Live API-Football sync arrives in Phase 6b.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---- Fixtures --------------------------------------------------------------
create table if not exists public.fixtures (
  id           bigint generated always as identity primary key,
  external_ref text unique,                 -- API-Football fixture id (6b)
  league       text not null,
  season       integer,
  home         text not null,
  away         text not null,
  kickoff      timestamptz not null,
  status       text not null default 'scheduled'
                 check (status in ('scheduled', 'live', 'finished', 'postponed')),
  minute       integer,
  home_score   integer,
  away_score   integer,
  -- odds: { "1x2": {home,draw,away}, "ou25": {over,under}, "btts": {yes,no} }
  odds         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists fixtures_kickoff_idx on public.fixtures (kickoff);

-- ---- Bets + selections -----------------------------------------------------
create table if not exists public.bets (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  stake             bigint not null check (stake > 0),
  combined_odds     numeric(12, 4) not null check (combined_odds >= 1),
  potential_payout  bigint not null check (potential_payout >= 0),
  status            text not null default 'pending'
                      check (status in ('pending', 'won', 'lost', 'void')),
  created_at        timestamptz not null default now(),
  settled_at        timestamptz
);

create index if not exists bets_user_idx on public.bets (user_id, created_at desc);

create table if not exists public.bet_selections (
  id          bigint generated always as identity primary key,
  bet_id      bigint not null references public.bets (id) on delete cascade,
  fixture_id  bigint not null references public.fixtures (id),
  market      text not null check (market in ('1x2', 'ou25', 'btts')),
  selection   text not null,
  odds        numeric(8, 3) not null check (odds >= 1),
  result      text not null default 'pending'
                check (result in ('pending', 'won', 'lost', 'void'))
);

create index if not exists bet_selections_bet_idx on public.bet_selections (bet_id);
create index if not exists bet_selections_fixture_idx on public.bet_selections (fixture_id);

-- ---- RLS -------------------------------------------------------------------
alter table public.fixtures enable row level security;
alter table public.bets enable row level security;
alter table public.bet_selections enable row level security;

drop policy if exists fixtures_read on public.fixtures;
create policy fixtures_read on public.fixtures
  for select to authenticated using (true);  -- fixtures/odds are public to users

drop policy if exists bets_select_own on public.bets;
create policy bets_select_own on public.bets
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists bet_selections_select_own on public.bet_selections;
create policy bet_selections_select_own on public.bet_selections
  for select to authenticated using (
    exists (select 1 from public.bets b
            where b.id = bet_id and (b.user_id = auth.uid() or public.is_admin()))
  );

-- ---- Outcome helpers (pure) ------------------------------------------------
-- Returns the winning selection for a market given the final score.
create or replace function public.fixture_market_result(p_market text, p_home int, p_away int)
  returns text language sql immutable as $$
  select case p_market
    when '1x2'  then case when p_home > p_away then 'home'
                          when p_home < p_away then 'away' else 'draw' end
    when 'ou25' then case when p_home + p_away > 2 then 'over' else 'under' end  -- 2.5 line
    when 'btts' then case when p_home > 0 and p_away > 0 then 'yes' else 'no' end
  end;
$$;

-- Valid selections per market (server-side validation, A05).
create or replace function public.fixture_market_valid(p_market text, p_selection text)
  returns boolean language sql immutable as $$
  select (p_market = '1x2'  and p_selection in ('home', 'draw', 'away'))
      or (p_market = 'ou25' and p_selection in ('over', 'under'))
      or (p_market = 'btts' and p_selection in ('yes', 'no'));
$$;

-- ---- place_bet -------------------------------------------------------------
-- p_selections: jsonb array of { fixture_id, market, selection }
create or replace function public.place_bet(p_selections jsonb, p_stake bigint)
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
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_selections) <> 'array' or jsonb_array_length(p_selections) = 0 then
    raise exception 'no selections' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_selections) > 12 then
    raise exception 'too many selections' using errcode = 'check_violation';
  end if;

  -- Validate each selection and recompute odds from server-held data.
  for v_sel in select * from jsonb_array_elements(p_selections) loop
    v_market := v_sel ->> 'market';
    v_selection := v_sel ->> 'selection';

    select * into v_fixture from public.fixtures where id = (v_sel ->> 'fixture_id')::bigint;
    if not found then raise exception 'unknown fixture' using errcode = 'check_violation'; end if;
    if v_fixture.status <> 'scheduled' or v_fixture.kickoff <= now() then
      raise exception 'fixture not open for betting' using errcode = 'check_violation';
    end if;
    if v_fixture.id = any(v_seen) then
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

  -- Lock balance + debit stake.
  select balance into v_balance from public.profiles where id = v_uid for update;
  if v_balance < p_stake then
    raise exception 'insufficient balance' using errcode = 'check_violation';
  end if;
  v_after := v_balance - p_stake;

  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'sportsbook', -p_stake, v_after,
          format('%s-leg bet', v_count));

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake,
         total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;

  insert into public.bets (user_id, stake, combined_odds, potential_payout)
  values (v_uid, p_stake, v_combined, v_payout)
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
    'combined_odds', v_combined, 'potential_payout', v_payout, 'balance', v_after);
end; $$;

revoke all on function public.place_bet(jsonb, bigint) from public;
grant execute on function public.place_bet(jsonb, bigint) to authenticated;

-- ---- Settlement ------------------------------------------------------------
-- Settle every pending selection on a finished fixture, then resolve affected
-- bets. Idempotent: only pending rows are touched, so re-runs are no-ops.
create or replace function public.settle_fixture(p_fixture_id bigint)
  returns void language plpgsql
  security definer set search_path = public, extensions as $$
declare
  v_fixture public.fixtures;
  v_bet record;
  v_winner text;
  v_sel record;
  v_after bigint; v_balance bigint;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id;
  if not found then raise exception 'fixture not found'; end if;
  if v_fixture.status <> 'finished' or v_fixture.home_score is null or v_fixture.away_score is null then
    raise exception 'fixture has no final score' using errcode = 'check_violation';
  end if;

  -- Mark each pending selection on this fixture won/lost.
  for v_sel in select * from public.bet_selections where fixture_id = p_fixture_id and result = 'pending' loop
    v_winner := public.fixture_market_result(v_sel.market, v_fixture.home_score, v_fixture.away_score);
    update public.bet_selections set result = case when v_sel.selection = v_winner then 'won' else 'lost' end
     where id = v_sel.id;
  end loop;

  -- Resolve each pending bet that has a selection on this fixture.
  for v_bet in
    select distinct b.* from public.bets b
      join public.bet_selections s on s.bet_id = b.id
     where s.fixture_id = p_fixture_id and b.status = 'pending'
  loop
    -- Any losing leg loses the bet.
    if exists (select 1 from public.bet_selections where bet_id = v_bet.id and result = 'lost') then
      update public.bets set status = 'lost', settled_at = now() where id = v_bet.id;
    -- All legs won → pay out once.
    elsif not exists (select 1 from public.bet_selections where bet_id = v_bet.id and result in ('pending')) then
      select balance into v_balance from public.profiles where id = v_bet.user_id for update;
      v_after := v_balance + v_bet.potential_payout;
      insert into public.transactions (user_id, type, game, amount, balance_after, note)
      values (v_bet.user_id, 'win', 'sportsbook', v_bet.potential_payout, v_after,
              format('bet #%s won', v_bet.id));
      update public.profiles
         set balance = v_after, total_won = total_won + v_bet.potential_payout,
             biggest_win = greatest(biggest_win, v_bet.potential_payout),
             games_won = games_won + 1
       where id = v_bet.user_id;
      update public.bets set status = 'won', settled_at = now() where id = v_bet.id;
    end if;
    -- otherwise the bet still has pending legs; leave it.
  end loop;
end; $$;

revoke all on function public.settle_fixture(bigint) from public;

-- Admin: set a final score and settle (manual until live sync lands in 6b).
create or replace function public.admin_settle_fixture(p_fixture_id bigint, p_home int, p_away int)
  returns void language plpgsql
  security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.fixtures
     set home_score = p_home, away_score = p_away, status = 'finished', updated_at = now()
   where id = p_fixture_id;
  perform public.settle_fixture(p_fixture_id);
end; $$;

revoke all on function public.admin_settle_fixture(bigint, int, int) from public;
grant execute on function public.admin_settle_fixture(bigint, int, int) to authenticated;

-- ---- Seed a few upcoming fixtures so betting is usable before 6b -----------
insert into public.fixtures (league, season, home, away, kickoff, odds)
select * from (values
  ('Primeira Liga', 2026, 'SL Benfica', 'FC Porto', now() + interval '2 days',
    '{"1x2":{"home":2.10,"draw":3.30,"away":3.40},"ou25":{"over":1.80,"under":1.95},"btts":{"yes":1.70,"no":2.05}}'::jsonb),
  ('Primeira Liga', 2026, 'Sporting CP', 'SC Braga', now() + interval '3 days',
    '{"1x2":{"home":1.65,"draw":3.80,"away":4.80},"ou25":{"over":1.75,"under":2.00},"btts":{"yes":1.80,"no":1.95}}'::jsonb),
  ('Primeira Liga', 2026, 'Vitória SC', 'Boavista FC', now() + interval '4 days',
    '{"1x2":{"home":2.30,"draw":3.10,"away":3.10},"ou25":{"over":2.05,"under":1.72},"btts":{"yes":1.90,"no":1.85}}'::jsonb)
) as v(league, season, home, away, kickoff, odds)
where not exists (select 1 from public.fixtures where league = 'Primeira Liga' and external_ref is null);
