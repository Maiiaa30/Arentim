-- ============================================================================
-- Arentim — Balatró: score only the cards that FORM the hand (like Balatro),
-- not every played card. A High Card scores just the highest card; pair-family
-- hands (pair / two pair / trips / four) score only the cards whose rank repeats
-- (kickers don't count); a Straight / Flush / Full House / Straight Flush score
-- all five. Mirrors scorePlay() in src/features/casino/balatro.ts exactly.
--
-- Because non-flush/straight hands now score fewer chips, the target is retuned
-- from 620 to 650 to keep a sensible-strategy win-rate ~0.48 (RTP ≈ 0.96).
-- balatro_eval (hand TYPE detection) is unchanged and still correct.
-- ============================================================================

create or replace function public.balatro_score(p_cards int[])
  returns jsonb language plpgsql immutable as $$
declare
  v_eval jsonb := public.balatro_eval(p_cards);
  v_type text := v_eval ->> 'type';
  v_base int  := (v_eval ->> 'base')::int;
  v_mult int  := (v_eval ->> 'mult')::int;
  v_chips int;
begin
  if v_type in ('flush', 'straight', 'straight_flush', 'full_house') then
    -- every card forms the hand
    select v_base + coalesce(sum(public.balatro_chip(c % 13)), 0) into v_chips
      from unnest(p_cards) as c;
  elsif v_type = 'high_card' then
    -- only the single highest-rank card scores
    select v_base + public.balatro_chip(max(c % 13)) into v_chips
      from unnest(p_cards) as c;
  else
    -- pair / two_pair / three_of_a_kind / four_of_a_kind: only the cards whose
    -- rank repeats (count >= 2) score; the kickers are ignored.
    select v_base + coalesce(sum(public.balatro_chip(rk)) filter (where cnt >= 2), 0) into v_chips
      from (select (c % 13) as rk, count(*) over (partition by c % 13) as cnt
              from unnest(p_cards) as c) t;
  end if;
  return jsonb_build_object('type', v_type, 'gained', v_chips * v_mult);
end; $$;

-- balatro_start — identical to the original, only the target changes (620 → 650).
create or replace function public.balatro_start(p_stake bigint)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint; v_after bigint;
  v_deck int[]; v_i int; v_j int; v_tmp int; v_hand int[];
  v_target int := 650;  -- mirrors BALATRO_TARGET
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

  v_deck := array(select generate_series(0, 51));
  for v_i in reverse 52..2 loop
    v_j := public.csprng_below(v_i);
    v_tmp := v_deck[v_i]; v_deck[v_i] := v_deck[v_j + 1]; v_deck[v_j + 1] := v_tmp;
  end loop;

  v_hand := v_deck[1:8];

  insert into public.balatro_rounds (user_id, stake, deck, deck_pos, hand, score, target, hands_left, discards_left)
  values (v_uid, p_stake, v_deck, 9, v_hand, 0, v_target, 4, 3);

  return jsonb_build_object('hand', to_jsonb(v_hand), 'target', v_target, 'score', 0,
    'hands_left', 4, 'discards_left', 3, 'reward', 2.0, 'status', 'playing');
end; $$;
revoke all on function public.balatro_start(bigint) from public;
grant execute on function public.balatro_start(bigint) to authenticated;
