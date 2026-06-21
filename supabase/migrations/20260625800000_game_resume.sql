-- ============================================================================
-- Arentim — resume an in-progress single-player round. The stateful games keep
-- their round server-side (mines_rounds / chicken_rounds, hidden state, no client
-- SELECT policy), so a player who navigates away mid-round can come back and pick
-- up where they left off — the round lives until they cash out, bust, or start a
-- new one. These masked read RPCs expose only the safe, already-known state (no
-- mine layout / no survivable-lane count). Balatró already has balatro_current().
-- ============================================================================

-- Mines: current round (or null), masked — never the mine layout.
create or replace function public.mines_current()
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare v_uid uuid := auth.uid(); v_r public.mines_rounds; v_k int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_r from public.mines_rounds where user_id = v_uid;
  if not found then return null; end if;
  v_k := coalesce(array_length(v_r.picks, 1), 0);
  return jsonb_build_object(
    'mines', v_r.mines, 'stake', v_r.stake, 'picks', to_jsonb(v_r.picks),
    'multiplier', public.mines_mult(v_k, v_r.mines),
    'next_multiplier', public.mines_mult(v_k + 1, v_r.mines));
end; $$;
revoke all on function public.mines_current() from public;
grant execute on function public.mines_current() to authenticated;

-- Chicken: current round (or null), masked — never the survivable-lane count.
create or replace function public.chicken_current()
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare v_uid uuid := auth.uid(); v_r public.chicken_rounds; v_diff text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_r from public.chicken_rounds where user_id = v_uid;
  if not found then return null; end if;
  v_diff := case when v_r.surv <= 0.45 then 'hard' when v_r.surv <= 0.65 then 'medium' else 'easy' end;
  return jsonb_build_object(
    'difficulty', v_diff, 'step', v_r.step, 'stake', v_r.stake,
    'multiplier', public.chicken_mult(v_r.step, v_r.surv));
end; $$;
revoke all on function public.chicken_current() from public;
grant execute on function public.chicken_current() to authenticated;
