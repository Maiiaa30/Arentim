-- ============================================================================
-- Arentim — Phase 10: private poker tables with friends.
--
-- Server-authoritative like the bots game: the full table state (deck + every
-- player's hole cards) lives in poker_tables with NO client read access. Each
-- player only ever receives their own sanitized view from the poker-table Edge
-- Function. Buy-ins/cash-outs flow through apply_ledger_entry.
-- ============================================================================

create table if not exists public.poker_tables (
  id            bigint generated always as identity primary key,
  code          text not null unique,
  host_id       uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'lobby' check (status in ('lobby', 'active', 'closed')),
  buy_in        bigint not null check (buy_in > 0),
  state         jsonb not null,
  turn_deadline timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.poker_table_members (
  table_id  bigint not null references public.poker_tables (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (table_id, user_id)
);

alter table public.poker_tables enable row level security;
alter table public.poker_table_members enable row level security;

-- State is private; clients only get sanitized views from the Edge Function.
drop policy if exists poker_tables_admin_select on public.poker_tables;
create policy poker_tables_admin_select on public.poker_tables
  for select to authenticated using (public.is_admin());

drop policy if exists poker_members_select_own on public.poker_table_members;
create policy poker_members_select_own on public.poker_table_members
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Tables the current user is seated at (for the lobby list).
create or replace function public.list_my_poker_tables()
  returns table (table_id bigint, code text, status text, player_count int, is_host boolean)
  language sql stable security definer set search_path = public as $$
  select t.id, t.code, t.status,
         (select count(*)::int from public.poker_table_members m2 where m2.table_id = t.id),
         (t.host_id = auth.uid())
    from public.poker_tables t
    join public.poker_table_members m on m.table_id = t.id and m.user_id = auth.uid()
   where t.status <> 'closed'
   order by t.created_at desc;
$$;
revoke all on function public.list_my_poker_tables() from public;
grant execute on function public.list_my_poker_tables() to authenticated;
