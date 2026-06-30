-- ============================================================================
-- Arentim — add tables to the Supabase Realtime publication so the browser can
-- subscribe to row changes and refresh without a page reload. RLS still governs
-- exactly which rows each client receives (own friendships / own notifications /
-- own profile row). crash_bets and roulette_room_bets are added in their own
-- later migrations (the tables don't exist yet here).
-- ============================================================================

do $$
declare
  t text;
begin
  -- The publication is created by Supabase; guard in case it is absent locally.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['friendships', 'notifications', 'profiles'] loop
      if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
