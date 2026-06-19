-- ============================================================================
-- Arentim — store team crest/flag image URLs on fixtures.
--
-- Football-Data.org returns a `crest` URL per team (club crest or national
-- flag). We cache it on the fixture so the Resultados/sportsbook UI can show the
-- real logo instead of a coloured initials disc. Nullable; sync populates it.
-- ============================================================================

alter table public.fixtures add column if not exists home_crest text;
alter table public.fixtures add column if not exists away_crest text;
