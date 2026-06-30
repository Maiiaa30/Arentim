-- ============================================================================
-- Arentim — Phase 5b: Blackjack (server-authoritative, deck hidden).
--
-- The shuffled deck and the dealer's hole card live in blackjack_hands, which
-- has NO client SELECT policy — the browser only ever sees sanitized state
-- returned by the RPCs (its own cards + the dealer up-card until showdown).
-- Rules mirror the unit-tested engine in src/features/casino/blackjack.ts:
-- dealer stands on all 17, blackjack pays 3:2, hit/stand/double/split (one
-- split, max 2 hands). Money moves atomically inside each RPC call.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.blackjack_hands (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'player_turn'
                check (status in ('player_turn', 'complete')),
  deck        integer[] not null,         -- remaining cards (HIDDEN from client)
  dealer      integer[] not null,         -- dealer cards (hole hidden until done)
  hands       jsonb not null,             -- [{cards:int[],stake,status,natural}]
  active      integer not null default 0,
  payout      bigint not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists blackjack_hands_user_idx
  on public.blackjack_hands (user_id, created_at desc);

alter table public.blackjack_hands enable row level security;
-- No SELECT/INSERT/UPDATE policy for clients: the deck and hole card must never
-- be readable. Admins may read for audit.
drop policy if exists blackjack_admin_select on public.blackjack_hands;
create policy blackjack_admin_select on public.blackjack_hands
  for select to authenticated using (public.is_admin());

-- ---- Pure helpers (mirror blackjack.ts) ------------------------------------
create or replace function public.bj_card_value(card integer)
  returns integer language sql immutable as $$
  select case when card % 13 = 0 then 11 when card % 13 >= 9 then 10 else (card % 13) + 1 end;
$$;

create or replace function public.bj_total(cards integer[])
  returns integer language plpgsql immutable as $$
declare t integer := 0; a integer := 0; c integer;
begin
  if cards is null then return 0; end if;
  foreach c in array cards loop
    if c % 13 = 0 then a := a + 1; end if;
    t := t + public.bj_card_value(c);
  end loop;
  while t > 21 and a > 0 loop t := t - 10; a := a - 1; end loop;
  return t;
end; $$;

create or replace function public.bj_shuffle()
  returns integer[] language plpgsql volatile
  security definer set search_path = public, extensions as $$
declare d integer[]; i integer; j integer; tmp integer;
begin
  d := array(select generate_series(0, 51));
  for i in reverse 52..2 loop
    j := public.csprng_below(i) + 1;  -- 1..i
    tmp := d[i]; d[i] := d[j]; d[j] := tmp;
  end loop;
  return d;
end; $$;
revoke all on function public.bj_shuffle() from public;

-- jsonb int-array -> int[]
create or replace function public.bj_ints(arr jsonb)
  returns integer[] language sql immutable as $$
  select array(select (e)::integer from jsonb_array_elements_text(arr) e);
$$;

-- Sanitized client view of a hand row.
create or replace function public.bj_view(h public.blackjack_hands)
  returns jsonb language plpgsql stable as $$
declare
  v_reveal boolean := (h.status = 'complete');
  v_hands jsonb := '[]'::jsonb;
  v_hand jsonb;
  v_cards integer[];
  v_active jsonb;
  v_can_double boolean := false;
  v_can_split boolean := false;
begin
  for v_hand in select * from jsonb_array_elements(h.hands) loop
    v_cards := public.bj_ints(v_hand -> 'cards');
    v_hands := v_hands || jsonb_build_object(
      'cards', v_hand -> 'cards',
      'total', public.bj_total(v_cards),
      'stake', (v_hand ->> 'stake')::bigint,
      'status', v_hand ->> 'status'
    );
  end loop;

  if h.status = 'player_turn' then
    v_active := h.hands -> h.active;
    v_cards := public.bj_ints(v_active -> 'cards');
    v_can_double := jsonb_array_length(v_active -> 'cards') = 2;
    v_can_split := jsonb_array_length(v_active -> 'cards') = 2
      and jsonb_array_length(h.hands) < 2
      and public.bj_card_value(v_cards[1]) = public.bj_card_value(v_cards[2]);
  end if;

  return jsonb_build_object(
    'hand_id', h.id,
    'status', h.status,
    'active', h.active,
    'dealer', case when v_reveal then to_jsonb(h.dealer)
                   else jsonb_build_array(h.dealer[1]) end,
    'dealer_total', case when v_reveal then public.bj_total(h.dealer) else null end,
    'dealer_hidden', not v_reveal,
    'hands', v_hands,
    'payout', h.payout,
    'options', case when h.status = 'player_turn'
      then jsonb_build_object('can_hit', true, 'can_stand', true,
                              'can_double', v_can_double, 'can_split', v_can_split)
      else null end
  );
end; $$;

-- Settle all hands against the dealer, credit returns, finalize stats.
create or replace function public.bj_settle(h public.blackjack_hands)
  returns public.blackjack_hands language plpgsql
  security definer set search_path = public, extensions as $$
declare
  v_dealer integer[] := h.dealer;
  v_deck integer[] := h.deck;
  v_hands jsonb := '[]'::jsonb;
  v_hand jsonb;
  v_cards integer[];
  v_pt integer; v_dt integer;
  v_outcome text;
  v_stake bigint;
  v_ret bigint;
  v_total_return bigint := 0;
  v_total_stake bigint := 0;
  v_any_live boolean := false;
  v_balance bigint;
  v_after bigint;
begin
  -- Does any non-busted hand remain? If all busted, dealer needn't draw.
  for v_hand in select * from jsonb_array_elements(h.hands) loop
    if (v_hand ->> 'status') <> 'busted' then v_any_live := true; end if;
  end loop;

  if v_any_live then
    while public.bj_total(v_dealer) < 17 loop
      v_dealer := v_dealer || v_deck[1];
      v_deck := v_deck[2:];
    end loop;
  end if;

  v_dt := public.bj_total(v_dealer);

  for v_hand in select * from jsonb_array_elements(h.hands) loop
    v_cards := public.bj_ints(v_hand -> 'cards');
    v_stake := (v_hand ->> 'stake')::bigint;
    v_total_stake := v_total_stake + v_stake;
    v_pt := public.bj_total(v_cards);

    if (v_hand ->> 'status') = 'busted' or v_pt > 21 then
      v_outcome := 'lose';
    elsif (v_hand ->> 'natural')::boolean and public.bj_total(v_dealer) = 21
          and array_length(v_dealer, 1) = 2 then
      v_outcome := 'push';
    elsif (v_hand ->> 'natural')::boolean then
      v_outcome := 'blackjack';
    elsif v_dt > 21 or v_pt > v_dt then
      v_outcome := 'win';
    elsif v_pt < v_dt then
      v_outcome := 'lose';
    else
      v_outcome := 'push';
    end if;

    v_ret := case v_outcome
      when 'blackjack' then floor(v_stake * 2.5)::bigint
      when 'win' then v_stake * 2
      when 'push' then v_stake
      else 0 end;
    v_total_return := v_total_return + v_ret;

    v_hands := v_hands || jsonb_build_object(
      'cards', v_hand -> 'cards', 'stake', v_stake,
      'status', v_outcome, 'natural', (v_hand ->> 'natural')::boolean, 'return', v_ret
    );
  end loop;

  -- Lock + credit returns in one shot.
  select balance into v_balance from public.profiles where id = h.user_id for update;
  v_after := v_balance + v_total_return;

  if v_total_return > 0 then
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (h.user_id, 'win', 'blackjack', v_total_return, v_after,
            format('blackjack settled (%s)', v_dt));
  end if;

  -- NB: total_lost / total_wagered are accumulated at debit time (deal, double,
  -- split). Settlement only credits returns and records the win side, so stakes
  -- are never counted twice.
  update public.profiles
     set balance     = v_after,
         total_won    = total_won + v_total_return,
         biggest_win  = greatest(biggest_win, v_total_return),
         games_won    = games_won + (case when v_total_return > v_total_stake then 1 else 0 end)
   where id = h.user_id;

  update public.blackjack_hands
     set status = 'complete', dealer = v_dealer, deck = v_deck,
         hands = v_hands, payout = v_total_return
   where id = h.id
  returning * into h;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
  values (h.user_id, 'blackjack', v_total_stake, v_total_return,
          jsonb_build_object('dealer_total', v_dt), jsonb_build_object('hands', v_hands));

  return h;
end; $$;

-- ---- Deal a new hand -------------------------------------------------------
create or replace function public.bj_deal(p_stake bigint)
  returns jsonb language plpgsql volatile
  security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint; v_after bigint;
  v_deck integer[]; v_player integer[]; v_dealer integer[];
  v_natural boolean;
  h public.blackjack_hands;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.blackjack_hands
             where user_id = v_uid and status = 'player_turn') then
    raise exception 'finish your current hand first' using errcode = 'check_violation';
  end if;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then
    raise exception 'insufficient balance' using errcode = 'check_violation';
  end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'blackjack', -p_stake, v_after, 'blackjack deal');

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake,
         total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;

  v_deck := public.bj_shuffle();
  v_player := array[v_deck[1], v_deck[3]];   -- alternate deal
  v_dealer := array[v_deck[2], v_deck[4]];
  v_deck := v_deck[5:];
  v_natural := (public.bj_total(v_player) = 21);

  insert into public.blackjack_hands (user_id, status, deck, dealer, hands, active)
  values (
    v_uid,
    case when v_natural then 'complete' else 'player_turn' end,
    v_deck, v_dealer,
    jsonb_build_array(jsonb_build_object(
      'cards', to_jsonb(v_player), 'stake', p_stake, 'status',
      case when v_natural then 'stood' else 'playing' end, 'natural', v_natural)),
    0
  )
  returning * into h;

  if v_natural then
    h := public.bj_settle(h);
  end if;

  return public.bj_view(h);
end; $$;

revoke all on function public.bj_deal(bigint) from public;
grant execute on function public.bj_deal(bigint) to authenticated;

-- ---- Player action ---------------------------------------------------------
create or replace function public.bj_action(p_hand_id bigint, p_action text)
  returns jsonb language plpgsql volatile
  security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  h public.blackjack_hands;
  v_active jsonb; v_cards integer[]; v_stake bigint;
  v_balance bigint; v_after bigint;
  v_new_cards integer[]; v_idx integer; v_next integer;
  v_hands jsonb; v_split_card integer;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_action not in ('hit', 'stand', 'double', 'split') then
    raise exception 'invalid action' using errcode = 'check_violation';
  end if;

  select * into h from public.blackjack_hands where id = p_hand_id for update;
  if not found or h.user_id <> v_uid then raise exception 'hand not found'; end if;
  if h.status <> 'player_turn' then raise exception 'hand is not in play' using errcode = 'check_violation'; end if;

  v_idx := h.active;
  v_active := h.hands -> v_idx;
  v_cards := public.bj_ints(v_active -> 'cards');
  v_stake := (v_active ->> 'stake')::bigint;

  if p_action = 'hit' then
    v_cards := v_cards || h.deck[1];
    h.deck := h.deck[2:];
    h.hands := jsonb_set(h.hands, array[v_idx::text, 'cards'], to_jsonb(v_cards));
    if public.bj_total(v_cards) > 21 then
      h.hands := jsonb_set(h.hands, array[v_idx::text, 'status'], '"busted"');
    end if;

  elsif p_action = 'stand' then
    h.hands := jsonb_set(h.hands, array[v_idx::text, 'status'], '"stood"');

  elsif p_action = 'double' then
    if jsonb_array_length(v_active -> 'cards') <> 2 then
      raise exception 'can only double on the first two cards' using errcode = 'check_violation';
    end if;
    select balance into v_balance from public.profiles where id = v_uid for update;
    if v_balance < v_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;
    v_after := v_balance - v_stake;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'bet', 'blackjack', -v_stake, v_after, 'blackjack double');
    update public.profiles set balance = v_after, total_wagered = total_wagered + v_stake,
           total_lost = total_lost + v_stake where id = v_uid;
    v_cards := v_cards || h.deck[1];
    h.deck := h.deck[2:];
    h.hands := jsonb_set(h.hands, array[v_idx::text, 'cards'], to_jsonb(v_cards));
    h.hands := jsonb_set(h.hands, array[v_idx::text, 'stake'], to_jsonb(v_stake * 2));
    h.hands := jsonb_set(h.hands, array[v_idx::text, 'status'],
                 case when public.bj_total(v_cards) > 21 then '"busted"'::jsonb else '"stood"'::jsonb end);

  elsif p_action = 'split' then
    if jsonb_array_length(h.hands) >= 2 then raise exception 'already split' using errcode = 'check_violation'; end if;
    if jsonb_array_length(v_active -> 'cards') <> 2
       or public.bj_card_value(v_cards[1]) <> public.bj_card_value(v_cards[2]) then
      raise exception 'cannot split this hand' using errcode = 'check_violation';
    end if;
    select balance into v_balance from public.profiles where id = v_uid for update;
    if v_balance < v_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;
    v_after := v_balance - v_stake;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'bet', 'blackjack', -v_stake, v_after, 'blackjack split');
    update public.profiles set balance = v_after, total_wagered = total_wagered + v_stake,
           total_lost = total_lost + v_stake where id = v_uid;
    -- Deal one fresh card to each split hand.
    v_split_card := v_cards[2];
    v_hands := jsonb_build_array(
      jsonb_build_object('cards', jsonb_build_array(v_cards[1], h.deck[1]),
                         'stake', v_stake, 'status', 'playing', 'natural', false),
      jsonb_build_object('cards', jsonb_build_array(v_split_card, h.deck[2]),
                         'stake', v_stake, 'status', 'playing', 'natural', false)
    );
    h.deck := h.deck[3:];
    h.hands := v_hands;
    update public.blackjack_hands set deck = h.deck, dealer = h.dealer, hands = h.hands, active = h.active
      where id = h.id returning * into h;
    return public.bj_view(h);  -- stay on first split hand
  end if;

  -- Advance to the next playable hand, or run the dealer + settle.
  v_next := null;
  for v_idx in (select i from generate_series(0, jsonb_array_length(h.hands) - 1) i) loop
    if (h.hands -> v_idx ->> 'status') = 'playing' then v_next := v_idx; exit; end if;
  end loop;

  if v_next is null then
    update public.blackjack_hands set deck = h.deck, dealer = h.dealer, hands = h.hands
      where id = h.id returning * into h;
    h := public.bj_settle(h);
  else
    update public.blackjack_hands set deck = h.deck, dealer = h.dealer, hands = h.hands, active = v_next
      where id = h.id returning * into h;
  end if;

  return public.bj_view(h);
end; $$;

revoke all on function public.bj_action(bigint, text) from public;
grant execute on function public.bj_action(bigint, text) to authenticated;

-- ---- Resume the current in-play hand (page reload) -------------------------
create or replace function public.bj_current()
  returns jsonb language plpgsql stable
  security definer set search_path = public, extensions as $$
declare h public.blackjack_hands;
begin
  if auth.uid() is null then return null; end if;
  select * into h from public.blackjack_hands
   where user_id = auth.uid() and status = 'player_turn'
   order by created_at desc limit 1;
  if not found then return null; end if;
  return public.bj_view(h);
end; $$;

revoke all on function public.bj_current() from public;
grant execute on function public.bj_current() to authenticated;
