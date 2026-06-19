-- ============================================================================
-- Arentim — cache a standings snapshot per fixture for the match-detail popup.
--
-- sync-fixtures already fetches each competition's standings to build odds, so
-- it stores both teams' snapshot (position, W-D-L, goals, points, recent form)
-- on the fixture. The Resultados popup reads it with no extra API calls.
-- ============================================================================

alter table public.fixtures add column if not exists stats jsonb not null default '{}'::jsonb;
