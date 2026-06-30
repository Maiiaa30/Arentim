-- ============================================================================
-- Arentim — Roleta: make the "números em destaque" (lucky numbers) GLOBAL, i.e.
-- the same for everyone in the shared live room, instead of a per-player draw.
--
-- roulette_room_now() returns roulette_get_bonus(), which used to read the
-- caller's per-profile bonus (so each player saw different numbers). Redefine it
-- as a pure, deterministic function of the CURRENT room id, so every player in
-- the same round sees the same 3 highlighted numbers, and they change each round.
-- Still cosmetic (mult = 1) — a payout bonus on a near-fair wheel is an exploit
-- (see 20260625200000_game_balance_fixes), so these only highlight the board.
-- ============================================================================

create or replace function public.roulette_get_bonus()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_room bigint;
  a int; b int; c int;
begin
  select id into v_room from public.roulette_rooms order by id desc limit 1;
  if v_room is null then v_room := 0; end if;
  -- Three distinct pockets 0..36 derived deterministically from the room id —
  -- identical for every player this round, fresh next round.
  a := (v_room * 7 + 3)  % 37;
  b := (v_room * 13 + 11) % 37;
  c := (v_room * 17 + 29) % 37;
  if b = a then b := (b + 1) % 37; end if;
  while c = a or c = b loop c := (c + 1) % 37; end loop;
  return jsonb_build_object('numbers', jsonb_build_array(a, b, c), 'mult', 1);
end; $$;
revoke all on function public.roulette_get_bonus() from public;
grant execute on function public.roulette_get_bonus() to authenticated;
