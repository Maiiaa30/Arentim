-- ============================================================================
-- Arentim — Balatró. A single-blind skill-poker mini-game. The player stakes,
-- gets a fresh shuffled 52-card deck (HIDDEN, server-side), an 8-card hand, and
-- must reach a TARGET score with 4 hands to play and 3 discards. Server-
-- authoritative: the deck lives in this round table which has NO client SELECT
-- policy — the hand is only ever revealed through the RPCs below. A pure-JS
-- engine (src/features/casino/balatro.ts) mirrors every number here.
--
-- Card encoding 0..51: suit = card / 13 (0=♠ 1=♥ 2=♦ 3=♣),
--   rank = card % 13 (0='2' … 8='10', 9='J', 10='Q', 11='K', 12='A').
--
-- SCORING of a played selection:
--   gained = (handBaseChips + Σ chipValue(played cards)) × handMult
-- where the hand type is the BEST poker hand formed by the selected cards.
--
-- SIMPLIFICATION (must match the JS engine): ALL played cards contribute their
-- chip value, not only the "scoring" cards of the hand. This keeps the SQL and
-- JS trivially in lockstep.
--
-- Hand table (base chips, mult):
--   High Card 5×1 · Pair 10×2 · Two Pair 20×2 · Three 30×3 · Straight 30×4 ·
--   Flush 35×4 · Full House 40×4 · Four 60×7 · Straight Flush 100×8.
-- Straight/Flush/FullHouse/StraightFlush need exactly 5 cards; Four needs ≥4.
-- Straights allow A-low (A,2,3,4,5) and A-high (10,J,Q,K,A).
--
-- Win the instant total ≥ target → payout floor(stake × 2). Lose if the 4th
-- hand is played and total < target. Discards never settle. Target tuned via a
-- Monte-Carlo so a sensible greedy strategy wins ≈ 48% (RTP ≈ 0.96).
-- ============================================================================

create table if not exists public.balatro_rounds (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  stake         bigint not null check (stake > 0),
  deck          int[] not null,        -- HIDDEN shuffled 52-card deck
  deck_pos      int not null,          -- next card to draw (1-indexed into deck)
  hand          int[] not null,        -- the 8 cards currently held
  score         int not null default 0,
  target        int not null,
  hands_left    int not null,
  discards_left int not null,
  created_at    timestamptz not null default now()
);
-- Hidden info (deck/hand) → RLS enabled, NO select policy (reads via RPC only).
alter table public.balatro_rounds enable row level security;

-- Chip value of a rank index 0..12: 2..10 → face, J/Q/K → 10, A → 11.
create or replace function public.balatro_chip(p_rank int)
  returns int language sql immutable as $$
  select case when p_rank <= 8 then p_rank + 2   -- 0..8 → 2..10
              when p_rank <= 11 then 10          -- J,Q,K
              else 11 end;                       -- A
$$;

-- Best poker hand from 1..5 cards → jsonb {type, base, mult}. Mirrors evaluateHand.
create or replace function public.balatro_eval(p_cards int[])
  returns jsonb language plpgsql immutable as $$
declare
  v_n int := coalesce(array_length(p_cards, 1), 0);
  v_ranks int[];
  v_suits int[];
  v_uniq int[];           -- distinct ranks, ascending
  v_counts int[];         -- rank multiplicities, descending
  v_flush boolean := false;
  v_straight boolean := false;
  v_type text;
  v_base int; v_mult int;
begin
  -- Decode ranks and suits.
  select array_agg(c % 13 order by ord), array_agg(c / 13 order by ord)
    into v_ranks, v_suits
  from unnest(p_cards) with ordinality as t(c, ord);

  -- Distinct ranks (ascending) and multiplicity counts (descending).
  select array_agg(r order by r) into v_uniq
  from (select distinct unnest(v_ranks) as r) u;

  select array_agg(cnt order by cnt desc) into v_counts
  from (select count(*) as cnt from unnest(v_ranks) as r group by r) c;

  -- Flush: 5 cards, all the same suit.
  if v_n = 5 then
    select count(distinct s) = 1 into v_flush from unnest(v_suits) as s;
  end if;

  -- Straight: exactly 5 distinct ranks forming a run, A-low or A-high.
  if v_n = 5 and array_length(v_uniq, 1) = 5 then
    if v_uniq = array[0,1,2,3,12] then
      v_straight := true;                       -- A-low: A,2,3,4,5
    elsif v_uniq[5] - v_uniq[1] = 4 then
      v_straight := true;                       -- consecutive (incl. 10,J,Q,K,A = 8..12)
    end if;
  end if;

  if v_straight and v_flush then
    v_type := 'straight_flush';
  elsif v_counts[1] >= 4 then
    v_type := 'four_of_a_kind';
  elsif v_counts[1] = 3 and coalesce(v_counts[2], 0) = 2 then
    v_type := 'full_house';
  elsif v_flush then
    v_type := 'flush';
  elsif v_straight then
    v_type := 'straight';
  elsif v_counts[1] = 3 then
    v_type := 'three_of_a_kind';
  elsif v_counts[1] = 2 and coalesce(v_counts[2], 0) = 2 then
    v_type := 'two_pair';
  elsif v_counts[1] = 2 then
    v_type := 'pair';
  else
    v_type := 'high_card';
  end if;

  v_base := case v_type
    when 'high_card' then 5  when 'pair' then 10 when 'two_pair' then 20
    when 'three_of_a_kind' then 30 when 'straight' then 30 when 'flush' then 35
    when 'full_house' then 40 when 'four_of_a_kind' then 60 else 100 end;
  v_mult := case v_type
    when 'high_card' then 1  when 'pair' then 2  when 'two_pair' then 2
    when 'three_of_a_kind' then 3 when 'straight' then 4 when 'flush' then 4
    when 'full_house' then 4 when 'four_of_a_kind' then 7 else 8 end;

  return jsonb_build_object('type', v_type, 'base', v_base, 'mult', v_mult);
end; $$;

-- Score a played selection: (base + Σ chipValue) × mult → jsonb {type, gained}.
create or replace function public.balatro_score(p_cards int[])
  returns jsonb language plpgsql immutable as $$
declare
  v_eval jsonb := public.balatro_eval(p_cards);
  v_chips int;
begin
  select (v_eval->>'base')::int + coalesce(sum(public.balatro_chip(c % 13)), 0)
    into v_chips
  from unnest(p_cards) as c;
  return jsonb_build_object('type', v_eval->>'type',
    'gained', v_chips * (v_eval->>'mult')::int);
end; $$;

-- Masked live state for the page (hand/score/target/counters); never the deck.
create or replace function public.balatro_state(p_r public.balatro_rounds)
  returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'hand', to_jsonb(p_r.hand), 'target', p_r.target, 'score', p_r.score,
    'hands_left', p_r.hands_left, 'discards_left', p_r.discards_left,
    'reward', 2.0, 'status', 'playing');
$$;

-- ---- balatro_start ----------------------------------------------------------
create or replace function public.balatro_start(p_stake bigint)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint; v_after bigint;
  v_deck int[]; v_i int; v_j int; v_tmp int; v_hand int[];
  v_target int := 620;  -- mirrors BALATRO_TARGET
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  delete from public.balatro_rounds where user_id = v_uid;  -- abandon = loss

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'balatro', -p_stake, v_after, 'balatro');
  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;

  -- Shuffle [0..51] (Fisher–Yates, 1-indexed arrays).
  v_deck := array(select generate_series(0, 51));
  for v_i in reverse 52..2 loop
    v_j := public.csprng_below(v_i);  -- 0..i-1
    v_tmp := v_deck[v_i]; v_deck[v_i] := v_deck[v_j + 1]; v_deck[v_j + 1] := v_tmp;
  end loop;

  v_hand := v_deck[1:8];  -- deal 8

  insert into public.balatro_rounds (user_id, stake, deck, deck_pos, hand, score, target, hands_left, discards_left)
  values (v_uid, p_stake, v_deck, 9, v_hand, 0, v_target, 4, 3);

  return jsonb_build_object('hand', to_jsonb(v_hand), 'target', v_target, 'score', 0,
    'hands_left', 4, 'discards_left', 3, 'reward', 2.0, 'status', 'playing');
end; $$;
revoke all on function public.balatro_start(bigint) from public;
grant execute on function public.balatro_start(bigint) to authenticated;

-- ---- balatro_play -----------------------------------------------------------
create or replace function public.balatro_play(p_cards int[])
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.balatro_rounds;
  v_len int; v_distinct int; v_subset boolean;
  v_eval jsonb; v_gained int; v_score int;
  v_new_hand int[]; v_draw int; v_payout bigint; v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_r from public.balatro_rounds where user_id = v_uid for update;
  if not found then raise exception 'no round' using errcode = 'check_violation'; end if;

  -- Validate: 1..5 cards, distinct, all members of the current hand.
  v_len := coalesce(array_length(p_cards, 1), 0);
  if v_len < 1 or v_len > 5 then raise exception 'invalid selection' using errcode = 'check_violation'; end if;
  select count(distinct c) into v_distinct from unnest(p_cards) as c;
  if v_distinct <> v_len then raise exception 'duplicate cards' using errcode = 'check_violation'; end if;
  select bool_and(c = any (v_r.hand)) into v_subset from unnest(p_cards) as c;
  if not v_subset then raise exception 'cards not in hand' using errcode = 'check_violation'; end if;

  -- Score and accumulate.
  v_eval := public.balatro_score(p_cards);
  v_gained := (v_eval->>'gained')::int;
  v_score := v_r.score + v_gained;

  -- Remove the played cards from the hand, then refill from the deck up to 8.
  select array_agg(c) into v_new_hand from unnest(v_r.hand) as c where not (c = any (p_cards));
  v_new_hand := coalesce(v_new_hand, '{}');
  v_draw := 8 - coalesce(array_length(v_new_hand, 1), 0);
  v_draw := least(v_draw, 52 - v_r.deck_pos + 1);
  if v_draw < 0 then v_draw := 0; end if;
  if v_draw > 0 then
    v_new_hand := v_new_hand || v_r.deck[v_r.deck_pos : v_r.deck_pos + v_draw - 1];
  end if;

  -- WIN: total reached the target.
  if v_score >= v_r.target then
    v_payout := floor(v_r.stake * 2);
    delete from public.balatro_rounds where user_id = v_uid;
    select balance into v_balance from public.profiles where id = v_uid for update;
    v_after := v_balance + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'balatro', v_payout, v_after, 'balatro');
    update public.profiles set balance = v_after, total_won = total_won + v_payout,
           games_won = games_won + 1, biggest_win = greatest(biggest_win, v_payout) where id = v_uid;
    insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
    values (v_uid, 'balatro', v_r.stake, v_payout,
            jsonb_build_object('won', true, 'score', v_score, 'target', v_r.target),
            jsonb_build_object('hand_type', v_eval->>'type', 'gained', v_gained));
    return jsonb_build_object('hand_type', v_eval->>'type', 'gained', v_gained, 'score', v_score,
      'hands_left', v_r.hands_left - 1, 'discards_left', v_r.discards_left,
      'played', to_jsonb(p_cards), 'hand', to_jsonb(v_new_hand),
      'status', 'won', 'payout', v_payout, 'balance', v_after);
  end if;

  -- LOSE: that was the last hand and we fell short.
  if v_r.hands_left - 1 <= 0 then
    delete from public.balatro_rounds where user_id = v_uid;
    insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
    values (v_uid, 'balatro', v_r.stake, 0,
            jsonb_build_object('won', false, 'score', v_score, 'target', v_r.target),
            jsonb_build_object('hand_type', v_eval->>'type', 'gained', v_gained));
    return jsonb_build_object('hand_type', v_eval->>'type', 'gained', v_gained, 'score', v_score,
      'hands_left', 0, 'discards_left', v_r.discards_left,
      'played', to_jsonb(p_cards), 'hand', to_jsonb(v_new_hand),
      'status', 'lost', 'payout', 0, 'balance', (select balance from public.profiles where id = v_uid));
  end if;

  -- Continue: persist the new hand / score / advanced deck position.
  update public.balatro_rounds
     set hand = v_new_hand, score = v_score, hands_left = v_r.hands_left - 1,
         deck_pos = v_r.deck_pos + v_draw
   where user_id = v_uid;

  return jsonb_build_object('hand_type', v_eval->>'type', 'gained', v_gained, 'score', v_score,
    'hands_left', v_r.hands_left - 1, 'discards_left', v_r.discards_left,
    'played', to_jsonb(p_cards), 'hand', to_jsonb(v_new_hand),
    'status', 'playing', 'payout', 0,
    'balance', (select balance from public.profiles where id = v_uid));
end; $$;
revoke all on function public.balatro_play(int[]) from public;
grant execute on function public.balatro_play(int[]) to authenticated;

-- ---- balatro_discard --------------------------------------------------------
create or replace function public.balatro_discard(p_cards int[])
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.balatro_rounds;
  v_len int; v_distinct int; v_subset boolean;
  v_new_hand int[]; v_draw int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_r from public.balatro_rounds where user_id = v_uid for update;
  if not found then raise exception 'no round' using errcode = 'check_violation'; end if;
  if v_r.discards_left <= 0 then raise exception 'no discards left' using errcode = 'check_violation'; end if;

  v_len := coalesce(array_length(p_cards, 1), 0);
  if v_len < 1 or v_len > 5 then raise exception 'invalid selection' using errcode = 'check_violation'; end if;
  select count(distinct c) into v_distinct from unnest(p_cards) as c;
  if v_distinct <> v_len then raise exception 'duplicate cards' using errcode = 'check_violation'; end if;
  select bool_and(c = any (v_r.hand)) into v_subset from unnest(p_cards) as c;
  if not v_subset then raise exception 'cards not in hand' using errcode = 'check_violation'; end if;

  -- Remove + redraw up to 8 from the deck.
  select array_agg(c) into v_new_hand from unnest(v_r.hand) as c where not (c = any (p_cards));
  v_new_hand := coalesce(v_new_hand, '{}');
  v_draw := 8 - coalesce(array_length(v_new_hand, 1), 0);
  v_draw := least(v_draw, 52 - v_r.deck_pos + 1);
  if v_draw < 0 then v_draw := 0; end if;
  if v_draw > 0 then
    v_new_hand := v_new_hand || v_r.deck[v_r.deck_pos : v_r.deck_pos + v_draw - 1];
  end if;

  update public.balatro_rounds
     set hand = v_new_hand, discards_left = v_r.discards_left - 1, deck_pos = v_r.deck_pos + v_draw
   where user_id = v_uid;

  return jsonb_build_object('hand', to_jsonb(v_new_hand), 'score', v_r.score, 'target', v_r.target,
    'hands_left', v_r.hands_left, 'discards_left', v_r.discards_left - 1,
    'status', 'playing', 'balance', (select balance from public.profiles where id = v_uid));
end; $$;
revoke all on function public.balatro_discard(int[]) from public;
grant execute on function public.balatro_discard(int[]) to authenticated;

-- ---- balatro_current --------------------------------------------------------
-- Resume an in-progress round: the masked live state, or null if none.
create or replace function public.balatro_current()
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.balatro_rounds;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_r from public.balatro_rounds where user_id = v_uid;
  if not found then return null; end if;
  return public.balatro_state(v_r);
end; $$;
revoke all on function public.balatro_current() from public;
grant execute on function public.balatro_current() to authenticated;
