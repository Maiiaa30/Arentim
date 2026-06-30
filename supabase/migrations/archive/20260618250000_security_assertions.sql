-- ============================================================================
-- Arentim — Phase 15: security assertions.
--
-- Closes the one RLS gap (the migration-runner's own bookkeeping table) and
-- asserts the invariant that EVERY table in `public` has RLS enabled. If a
-- future migration adds a table without RLS, re-running migrations fails loudly.
-- ============================================================================

-- The runner created this without RLS; enable it (no policy = deny to clients;
-- the runner connects as the table owner, which bypasses RLS when not forced).
alter table if exists public.arentim_migrations enable row level security;

do $$
declare
  r record;
  missing text := '';
begin
  for r in
    select tablename from pg_tables
     where schemaname = 'public' and rowsecurity = false
  loop
    missing := missing || ' ' || r.tablename;
  end loop;

  if length(missing) > 0 then
    raise exception 'RLS is not enabled on:%', missing;
  end if;
end $$;
