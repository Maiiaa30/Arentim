-- ============================================================================
-- Arentim — Battleship online (1v1). A hidden-state table holding both players'
-- boards; all access goes through the battleship-table Edge Function (service
-- role), so the table has RLS enabled with NO client policies — a player can
-- never read the opponent's ship positions via PostgREST. No money — for fun.
-- Matchmaking: invite-by-code (is_public = false) or a public queue (the oldest
-- waiting public table is claimed by 'find').
-- ============================================================================

create table if not exists public.battleship_tables (
  id         bigint generated always as identity primary key,
  code       text not null unique,                 -- invite code
  host_id    uuid not null references public.profiles (id) on delete cascade,
  guest_id   uuid references public.profiles (id) on delete cascade,
  is_public  boolean not null default false,        -- joinable from the public queue
  status     text not null default 'waiting'
               check (status in ('waiting', 'placing', 'playing', 'finished')),
  state      jsonb not null,                         -- BattleState (HIDDEN from clients)
  version    int not null default 0,                 -- optimistic-concurrency guard
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hidden state → RLS on, no client policies (reads/writes via the Edge Function).
alter table public.battleship_tables enable row level security;

-- The matchmaking queue: oldest waiting public table with no guest yet.
create index if not exists battleship_tables_queue_idx
  on public.battleship_tables (created_at)
  where status = 'waiting' and is_public and guest_id is null;

-- Resume lookups by participant (excludes finished games).
create index if not exists battleship_tables_host_idx
  on public.battleship_tables (host_id) where status <> 'finished';
create index if not exists battleship_tables_guest_idx
  on public.battleship_tables (guest_id) where status <> 'finished';
