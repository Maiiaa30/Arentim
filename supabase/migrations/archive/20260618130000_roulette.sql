-- ============================================================================
-- Arentim — Phase 3: European roulette (single 0).
--
-- The entire round runs in ONE atomic SECURITY DEFINER function:
--   validate bets → lock balance → debit stake → spin (server CSPRNG) →
--   credit winnings → record the round. A failure at any point rolls the whole
--   thing back, so money can never be left inconsistent (A06/A10).
--
-- RNG: pgcrypto's gen_random_bytes is a CSPRNG. We map a byte to 0–36 with
-- rejection sampling to avoid modulo bias. Never client-supplied (A06).
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- game_rounds — immutable record of every settled casino round (audit + history)
-- ----------------------------------------------------------------------------
create table if not exists public.game_rounds (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  game            text not null,
  stake           bigint not null check (stake >= 0),
  payout          bigint not null check (payout >= 0),
  outcome         jsonb not null,
  detail          jsonb,
  idempotency_key text,
  created_at      timestamptz not null default now()
);

create index if not exists game_rounds_user_created_idx
  on public.game_rounds (user_id, created_at desc);

create unique index if not exists game_rounds_idempotency_key_idx
  on public.game_rounds (idempotency_key)
  where idempotency_key is not null;

alter table public.game_rounds enable row level security;

drop policy if exists game_rounds_select_own on public.game_rounds;
create policy game_rounds_select_own on public.game_rounds
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- spin_roulette — unbiased CSPRNG number in [0, 36].
-- ----------------------------------------------------------------------------
create or replace function public.spin_roulette()
  returns integer
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  b integer;
begin
  -- 37 outcomes. Largest multiple of 37 <= 256 is 222 (37*6). Accept bytes in
  -- [0,221] (uniform mod 37); reject [222,255] and retry — no modulo bias.
  loop
    b := get_byte(gen_random_bytes(1), 0);
    if b < 222 then
      return b % 37;
    end if;
  end loop;
end;
$$;

revoke all on function public.spin_roulette() from public;
-- No client execute: spins only happen inside play_roulette.

-- ----------------------------------------------------------------------------
-- Roulette helpers (pure, mirror the frontend logic in src/features/casino).
-- ----------------------------------------------------------------------------

-- Red pockets on a European wheel.
create or replace function public.roulette_is_red(n integer)
  returns boolean
  language sql
  immutable
as $$
  select n in (1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36);
$$;

-- Does a single bet win against outcome n? Returns the total-return multiplier
-- (including stake) if it wins, else 0.
create or replace function public.roulette_multiplier(p_kind text, p_selection integer, n integer)
  returns integer
  language plpgsql
  immutable
as $$
begin
  -- 0 loses every outside bet; only a straight-up on 0 wins.
  case p_kind
    when 'straight' then
      return case when p_selection = n then 36 else 0 end;
    when 'red' then
      return case when n <> 0 and public.roulette_is_red(n) then 2 else 0 end;
    when 'black' then
      return case when n <> 0 and not public.roulette_is_red(n) then 2 else 0 end;
    when 'even' then
      return case when n <> 0 and n % 2 = 0 then 2 else 0 end;
    when 'odd' then
      return case when n % 2 = 1 then 2 else 0 end;
    when 'low' then
      return case when n between 1 and 18 then 2 else 0 end;
    when 'high' then
      return case when n between 19 and 36 then 2 else 0 end;
    when 'dozen1' then
      return case when n between 1 and 12 then 3 else 0 end;
    when 'dozen2' then
      return case when n between 13 and 24 then 3 else 0 end;
    when 'dozen3' then
      return case when n between 25 and 36 then 3 else 0 end;
    when 'col1' then
      return case when n <> 0 and n % 3 = 1 then 3 else 0 end;
    when 'col2' then
      return case when n <> 0 and n % 3 = 2 then 3 else 0 end;
    when 'col3' then
      return case when n <> 0 and n % 3 = 0 then 3 else 0 end;
    else
      raise exception 'invalid bet kind: %', p_kind using errcode = 'check_violation';
  end case;
end;
$$;

-- ----------------------------------------------------------------------------
-- play_roulette — place a slip of bets, spin once, settle atomically.
--
-- p_bets: jsonb array of { "kind": text, "selection": int|null, "stake": int }
-- Returns jsonb: { round_id, number, stake, payout, balance, results }
-- ----------------------------------------------------------------------------
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
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Idempotency: a retried spin returns the original settled round.
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
        'replayed', true
      );
    end if;
  end if;

  -- Validate bets and total the stake. All validation is server-side (A05).
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
    -- roulette_multiplier validates the kind (raises on unknown).
    perform public.roulette_multiplier(v_kind, coalesce(v_selection, -1), 0);

    v_total_stake := v_total_stake + v_stake;
    v_count := v_count + 1;
  end loop;

  -- Lock the player's row for the whole settlement (prevents double-spend).
  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'profile not found';
  end if;
  if v_balance < v_total_stake then
    raise exception 'insufficient balance' using errcode = 'check_violation';
  end if;

  -- Debit the total stake.
  v_after_bet := v_balance - v_total_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'roulette', -v_total_stake, v_after_bet, format('%s bet(s)', v_count));

  -- Spin once (server CSPRNG).
  v_number := public.spin_roulette();

  -- Settle each bet against the outcome.
  for v_bet in select * from jsonb_array_elements(p_bets) loop
    v_kind := v_bet ->> 'kind';
    v_stake := (v_bet ->> 'stake')::bigint;
    v_selection := nullif(v_bet ->> 'selection', '')::integer;
    v_mult := public.roulette_multiplier(v_kind, coalesce(v_selection, -1), v_number);
    v_win := v_stake * v_mult;   -- total return for this bet (0 if it lost)
    v_payout := v_payout + v_win;
    v_results := v_results || jsonb_build_object(
      'kind', v_kind, 'selection', v_selection, 'stake', v_stake, 'won', v_win > 0, 'return', v_win
    );
  end loop;

  -- Credit winnings (if any).
  v_after_win := v_after_bet + v_payout;
  if v_payout > 0 then
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'roulette', v_payout, v_after_win, format('roulette landed on %s', v_number));
  end if;

  -- Update balance + aggregates in one shot.
  update public.profiles
     set balance       = v_after_win,
         total_wagered  = total_wagered + v_total_stake,
         total_won      = total_won + v_payout,
         total_lost     = total_lost + v_total_stake,
         biggest_win    = greatest(biggest_win, v_payout),
         games_played   = games_played + 1,
         games_won      = games_won + (case when v_payout > 0 then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (
    v_uid, 'roulette', v_total_stake, v_payout,
    jsonb_build_object('number', v_number, 'color',
      case when v_number = 0 then 'green' when public.roulette_is_red(v_number) then 'red' else 'black' end),
    jsonb_build_object('results', v_results),
    p_idempotency_key
  )
  returning * into v_round;

  return jsonb_build_object(
    'round_id', v_round.id,
    'number', v_number,
    'stake', v_total_stake,
    'payout', v_payout,
    'balance', v_after_win,
    'results', v_results,
    'replayed', false
  );
end;
$$;

revoke all on function public.play_roulette(jsonb, text) from public;
grant execute on function public.play_roulette(jsonb, text) to authenticated;
