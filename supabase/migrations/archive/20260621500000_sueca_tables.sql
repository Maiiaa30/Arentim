-- ============================================================================
-- Arentim — multiplayer Sueca tables (2–4 humans, empty seats filled with bots).
-- The sueca-table Edge Function holds the deck/hands in `state` and exposes only
-- a per-seat view; this is just storage + a membership list (same shape as the
-- poker tables). Seats 0 & 2 are one team, 1 & 3 the other — players choose seats.
-- ============================================================================

create table if not exists public.sueca_tables (
  id         bigint generated always as identity primary key,
  code       text not null unique,
  host_id    uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'open' check (status in ('open', 'playing', 'closed')),
  seats      jsonb not null default '[null,null,null,null]'::jsonb, -- per-seat {user,name,bot} or null
  state      jsonb,                                                  -- SuecaState once started
  match      jsonb not null default '[0,0]'::jsonb,                  -- running games [teamA, teamB]
  dealer     int not null default 3,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.sueca_table_members (
  table_id bigint not null references public.sueca_tables (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (table_id, user_id)
);

alter table public.sueca_tables enable row level security;
alter table public.sueca_table_members enable row level security;

drop policy if exists sueca_members_select_own on public.sueca_table_members;
create policy sueca_members_select_own on public.sueca_table_members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists sueca_tables_select_member on public.sueca_tables;
create policy sueca_tables_select_member on public.sueca_tables
  for select to authenticated using (
    exists (select 1 from public.sueca_table_members m where m.table_id = id and m.user_id = auth.uid())
  );

-- Tables the caller is seated at (for the lobby list).
create or replace function public.list_my_sueca_tables()
  returns table (table_id bigint, code text, status text, player_count int, is_host boolean)
  language sql stable security definer set search_path = public
as $$
  select t.id, t.code, t.status,
         (select count(*)::int from public.sueca_table_members m where m.table_id = t.id),
         t.host_id = auth.uid()
  from public.sueca_tables t
  join public.sueca_table_members me on me.table_id = t.id and me.user_id = auth.uid()
  where t.status <> 'closed'
  order by t.updated_at desc;
$$;
revoke all on function public.list_my_sueca_tables() from public;
grant execute on function public.list_my_sueca_tables() to authenticated;
