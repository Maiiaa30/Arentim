-- ============================================================================
-- Arentim — per-session mini-game stats. Powers the "session summary" popup
-- shown when a player leaves a casino mini-game: how much they wagered, won,
-- net result, plays and biggest single win — derived from the immutable
-- transactions ledger (every game writes a 'bet' stake + 'win' payouts) for the
-- given game key(s) since the moment they opened the page.
--
-- Scoped to auth.uid() (reads only the caller's own ledger). Idempotent.
-- ============================================================================

create or replace function public.game_session_stats(p_games text[], p_since timestamptz)
  returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'wagered', coalesce(sum(case when t.type = 'bet' then -t.amount else 0 end), 0),
    'won',     coalesce(sum(case when t.type = 'win' then  t.amount else 0 end), 0),
    'plays',   coalesce(count(*) filter (where t.type = 'bet'), 0),
    'biggest', coalesce(max(case when t.type = 'win' then t.amount else 0 end), 0)
  )
  from public.transactions t
  where t.user_id = auth.uid()
    and t.game = any(p_games)
    and t.created_at >= p_since
    and t.type in ('bet', 'win');
$$;
revoke all on function public.game_session_stats(text[], timestamptz) from public;
grant execute on function public.game_session_stats(text[], timestamptz) to authenticated;
