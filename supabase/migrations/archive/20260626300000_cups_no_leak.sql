-- ============================================================================
-- Arentim — FIX: Jogo dos Copos was cheatable. cups_start returned the ball's
-- start position AND the full swap sequence, so the winning cup was trivially
-- computable from the network response (devtools) — a guaranteed-win exploit.
--
-- Make it cheat-proof: the winning cup is an independent hidden draw stored
-- server-side (cups_rounds has NO client SELECT policy — reads go only through
-- cups_pick). cups_start returns ONLY a cosmetic swap sequence for the shuffle
-- animation; it no longer reveals where the jewel is, and the swaps don't
-- determine the outcome. A pick is a fair 1/3 → 2.85× pays RTP ≈ 0.95.
-- ============================================================================

-- Belt-and-braces: ensure the round table can't be read by clients (the prize).
drop policy if exists cups_rounds_select_own on public.cups_rounds;

create or replace function public.cups_start(p_stake bigint)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint; v_after bigint;
  v_prize int; v_a int; v_b int; v_k int;
  v_swaps jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  delete from public.cups_rounds where user_id = v_uid;  -- abandoned = loss

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'chest', -p_stake, v_after, 'copos');
  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;

  -- The winning cup is an INDEPENDENT hidden draw — never derivable from anything
  -- sent to the client.
  v_prize := public.csprng_below(3);

  -- A purely cosmetic swap sequence for the shuffle animation (does not affect
  -- the outcome). Each swap exchanges two distinct positions.
  for v_k in 1..6 loop
    v_a := public.csprng_below(3);
    v_b := (v_a + 1 + public.csprng_below(2)) % 3;
    v_swaps := v_swaps || jsonb_build_array(jsonb_build_array(v_a, v_b));
  end loop;

  insert into public.cups_rounds (user_id, prize, stake) values (v_uid, v_prize, p_stake);

  -- NOTE: no 'start' and no prize — only the cosmetic shuffle + the public info.
  return jsonb_build_object('swaps', v_swaps, 'multiplier', 2.85, 'balance', v_after);
end;
$$;
revoke all on function public.cups_start(bigint) from public;
grant execute on function public.cups_start(bigint) to authenticated;
