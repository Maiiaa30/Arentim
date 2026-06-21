-- ============================================================================
-- Arentim — Sobe e Desce: a guaranteed side must not be a guaranteed loss.
-- On an extreme card (Ás/13 or the 2/1) one side is impossible and the other is
-- certain (12 winning cards out of 12). The adaptive formula paid 0.95×there —
-- i.e. you'd bet and *lose* 5% on a sure thing. A certain outcome can't pay a
-- profit (that would be free money), so it now pays exactly 1.0× (break-even).
-- ============================================================================

create or replace function public.hilo_mult(p_count int)
  returns numeric language sql immutable as $$
  select case when p_count <= 0 then 0
              when p_count >= 12 then 1.0
              else round(0.95 * 12.0 / p_count, 2) end;
$$;
