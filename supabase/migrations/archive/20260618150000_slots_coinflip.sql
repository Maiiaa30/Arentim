-- ============================================================================
-- Arentim — Phase 5a: Slots + Coin-flip (one-shot quick games).
--
-- Same atomic-settlement pattern as roulette: validate → lock → debit → roll
-- (server CSPRNG) → credit → record, all in one transaction, idempotent.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Unbiased CSPRNG integer in [0, p_n) for small ranges (p_n in 1..256).
create or replace function public.csprng_below(p_n integer)
  returns integer
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  v_limit integer;
  b integer;
begin
  if p_n < 1 or p_n > 256 then
    raise exception 'csprng_below range out of bounds: %', p_n;
  end if;
  v_limit := 256 - (256 % p_n);   -- largest multiple of p_n <= 256
  loop
    b := get_byte(gen_random_bytes(1), 0);
    if b < v_limit then
      return b % p_n;
    end if;
  end loop;
end;
$$;

revoke all on function public.csprng_below(integer) from public;

-- ----------------------------------------------------------------------------
-- Coin-flip — even-money double-or-nothing.
-- ----------------------------------------------------------------------------
create or replace function public.play_coinflip(
  p_stake bigint,
  p_choice text,                       -- 'heads' | 'tails'
  p_idempotency_key text default null
)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  v_uid      uuid := auth.uid();
  v_balance  bigint;
  v_after    bigint;
  v_outcome  text;
  v_win      boolean;
  v_payout   bigint := 0;
  v_existing public.game_rounds;
  v_round    public.game_rounds;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_choice not in ('heads', 'tails') then
    raise exception 'invalid choice' using errcode = 'check_violation';
  end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'outcome', v_existing.outcome ->> 'result', 'won', (v_existing.payout > 0),
        'payout', v_existing.payout, 'balance', (select balance from public.profiles where id = v_uid),
        'replayed', true
      );
    end if;
  end if;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then
    raise exception 'insufficient balance' using errcode = 'check_violation';
  end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'coinflip', -p_stake, v_after, 'coin flip');

  v_outcome := case when public.csprng_below(2) = 0 then 'heads' else 'tails' end;
  v_win := (v_outcome = p_choice);

  if v_win then
    v_payout := p_stake * 2;
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'coinflip', v_payout, v_after, format('coin landed %s', v_outcome));
  end if;

  update public.profiles
     set balance        = v_after,
         total_wagered    = total_wagered + p_stake,
         total_won        = total_won + v_payout,
         total_lost       = total_lost + p_stake,
         biggest_win      = greatest(biggest_win, v_payout),
         games_played     = games_played + 1,
         games_won        = games_won + (case when v_win then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'coinflip', p_stake, v_payout,
          jsonb_build_object('result', v_outcome, 'choice', p_choice),
          null, p_idempotency_key)
  returning * into v_round;

  return jsonb_build_object('outcome', v_outcome, 'won', v_win, 'payout', v_payout,
                            'balance', v_after, 'replayed', false);
end;
$$;

revoke all on function public.play_coinflip(bigint, text, text) from public;
grant execute on function public.play_coinflip(bigint, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Slots — 3 reels. Each reel is a 16-position strip (indices map to symbols):
--   0:coin  1-2:seven  3-5:galo  6-9:wine  10-15:sardine
-- Payout multiplier (on stake):
--   three of a kind: coin 100 · seven 40 · galo 18 · wine 13 · sardine 7
--   a premium pair:  coin 3 · seven 1  (galo/wine/sardine pairs pay 0)
-- RTP ≈ 0.87 (house edge ~13%); verified in src/features/casino/slots.test.ts.
-- ----------------------------------------------------------------------------
create or replace function public.slots_symbol(idx integer)
  returns text
  language sql
  immutable
as $$
  select case
    when idx = 0 then 'coin'
    when idx between 1 and 2 then 'seven'
    when idx between 3 and 5 then 'galo'
    when idx between 6 and 9 then 'wine'
    else 'sardine'
  end;
$$;

create or replace function public.slots_multiplier(s1 text, s2 text, s3 text)
  returns integer
  language plpgsql
  immutable
as $$
declare
  pay3 jsonb := '{"coin":100,"seven":40,"galo":18,"wine":13,"sardine":7}';
  pay2 jsonb := '{"coin":3,"seven":1,"galo":0,"wine":0,"sardine":0}';
  pair text;
begin
  if s1 = s2 and s2 = s3 then
    return (pay3 ->> s1)::int;
  end if;
  -- find a symbol appearing at least twice
  if s1 = s2 or s1 = s3 then pair := s1;
  elsif s2 = s3 then pair := s2;
  else return 0;
  end if;
  return coalesce((pay2 ->> pair)::int, 0);
end;
$$;

create or replace function public.play_slots(
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
  v_uid      uuid := auth.uid();
  v_balance  bigint;
  v_after    bigint;
  v_s1 text; v_s2 text; v_s3 text;
  v_mult     integer;
  v_payout   bigint := 0;
  v_existing public.game_rounds;
  v_round    public.game_rounds;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'reels', v_existing.outcome -> 'reels', 'payout', v_existing.payout,
        'balance', (select balance from public.profiles where id = v_uid), 'replayed', true
      );
    end if;
  end if;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then
    raise exception 'insufficient balance' using errcode = 'check_violation';
  end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'slots', -p_stake, v_after, 'slots spin');

  v_s1 := public.slots_symbol(public.csprng_below(16));
  v_s2 := public.slots_symbol(public.csprng_below(16));
  v_s3 := public.slots_symbol(public.csprng_below(16));
  v_mult := public.slots_multiplier(v_s1, v_s2, v_s3);
  v_payout := p_stake * v_mult;

  if v_payout > 0 then
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'slots', v_payout, v_after, format('slots %s-%s-%s', v_s1, v_s2, v_s3));
  end if;

  update public.profiles
     set balance        = v_after,
         total_wagered    = total_wagered + p_stake,
         total_won        = total_won + v_payout,
         total_lost       = total_lost + p_stake,
         biggest_win      = greatest(biggest_win, v_payout),
         games_played     = games_played + 1,
         games_won        = games_won + (case when v_payout > 0 then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'slots', p_stake, v_payout,
          jsonb_build_object('reels', jsonb_build_array(v_s1, v_s2, v_s3)),
          jsonb_build_object('multiplier', v_mult), p_idempotency_key)
  returning * into v_round;

  return jsonb_build_object('reels', jsonb_build_array(v_s1, v_s2, v_s3),
                            'multiplier', v_mult, 'payout', v_payout,
                            'balance', v_after, 'replayed', false);
end;
$$;

revoke all on function public.play_slots(bigint, text) from public;
grant execute on function public.play_slots(bigint, text) to authenticated;
