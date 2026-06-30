-- ============================================================================
-- Arentim — Phase 7: live scores.
--
-- Adds a live-events column, publishes fixtures + bets over Supabase Realtime
-- so clients see score/minute/settlement updates live, and lets the live-score
-- poller (service role) auto-settle finished fixtures.
-- ============================================================================

alter table public.fixtures
  add column if not exists events jsonb not null default '[]'::jsonb;

-- The live poller runs as service_role; allow it to auto-settle finished games.
grant execute on function public.settle_fixture(bigint) to service_role;

-- Publish to the Realtime stream (idempotent). RLS still applies to subscribers:
-- fixtures are world-readable to authenticated users; a user only receives bet
-- rows they own.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fixtures'
  ) then
    alter publication supabase_realtime add table public.fixtures;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bets'
  ) then
    alter publication supabase_realtime add table public.bets;
  end if;
end $$;
