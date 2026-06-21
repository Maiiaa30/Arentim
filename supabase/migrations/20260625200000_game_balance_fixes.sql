-- ============================================================================
-- Arentim — game-balance / exploit fixes (from a full algorithm audit).
--
-- 1) CRITICAL: the roulette "lucky-number" bonus was an exploit. The 3 lucky
--    numbers are committed and REVEALED before betting (roulette_get_bonus /
--    roulette_room_now), and a straight-up bet on one paid DOUBLE (36× → 72×).
--    A player who just bet straight-up on the 3 revealed numbers every round had
--    RTP = 72/37 ≈ 1.95 — a guaranteed profit that drains the play-money economy
--    (both single-shot play_roulette and the live roulette room).
--    On a fair 37-pocket wheel a straight already returns 36/37 ≈ 0.973, so ANY
--    positive multiplier on a player-known number is > 1.0 RTP — there is no safe
--    bonus factor. Fix: make the lucky numbers COSMETIC ("hot numbers") — they
--    are still drawn and highlighted, but pay the normal amount. We do this at the
--    single source both settlers read: roulette_new_bonus() now stores mult = 1,
--    so the existing `v_win * v_bonus_mult` doubling becomes a no-op (×1). No need
--    to touch the (large, working) settle functions.
--
-- 2) MEDIUM (latent): play_slot draws a reel position with csprng_below(strip_len)
--    and csprng_below raises for any argument > 256. Today every strip is ≤ 40, so
--    it works, but nothing enforced it. Add a CHECK so a long strip can never be
--    inserted and silently brick a machine.
--
-- Not changed (deliberate, per project design): coinflip 2× even-money ("dobro ou
-- nada") and the fair Crash curve (1/(1-u), floor 1.00) are intentional 0%-edge
-- games; tigrinho's low RTP is the joke. Those are by design, not bugs.
-- ============================================================================

-- 1) Lucky-number bonus → cosmetic (mult = 1). Numbers still shown/highlighted.
create or replace function public.roulette_new_bonus()
  returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare a int; b int; c int;
begin
  a := public.spin_roulette();
  loop b := public.spin_roulette(); exit when b <> a; end loop;
  loop c := public.spin_roulette(); exit when c <> a and c <> b; end loop;
  -- mult = 1: the "lucky numbers" are now a cosmetic highlight, not a payout
  -- boost. A non-1 multiple on a near-fair straight is a guaranteed-profit drain.
  return jsonb_build_object('numbers', jsonb_build_array(a, b, c), 'mult', 1);
end; $$;
revoke all on function public.roulette_new_bonus() from public;

-- Neutralise any bonus already committed at the old 2× before it gets re-rolled.
update public.profiles
   set roulette_bonus = jsonb_set(roulette_bonus, '{mult}', '1'::jsonb)
 where roulette_bonus is not null
   and coalesce((roulette_bonus ->> 'mult')::int, 1) <> 1;

-- 2) Defensive: a slot reel strip can never exceed the csprng_below(256) limit.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'slot_machines_strip_len') then
    alter table public.slot_machines
      add constraint slot_machines_strip_len check (jsonb_array_length(strip) <= 256);
  end if;
end $$;
