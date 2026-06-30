-- ============================================================================
-- Arentim — Phase 13: AI content layer (Gemini Flash, optional).
--
-- The generate-content Edge Function writes short, plain-text previews and a
-- "featured match" blurb here. The model output is treated as untrusted DATA:
-- it is only ever stored and displayed (React escapes it) — never executed,
-- never used to drive a query, action, or balance change.
-- ============================================================================

alter table public.fixtures add column if not exists preview text;

create table if not exists public.daily_content (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('featured', 'recap')),
  fixture_id  bigint references public.fixtures (id) on delete set null,
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists daily_content_created_idx on public.daily_content (created_at desc);

alter table public.daily_content enable row level security;
drop policy if exists daily_content_read on public.daily_content;
create policy daily_content_read on public.daily_content
  for select to authenticated using (true);
