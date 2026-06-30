-- Public poker tables.
--
-- A table can be flagged public: it still gets a join code, but it also shows up
-- in a lobby so anyone can browse it, spectate it live, and sit at an open seat
-- when one frees up. Private tables (the default) stay code-only.
alter table public.poker_tables
  add column if not exists is_public boolean not null default false;

create index if not exists poker_tables_public_idx
  on public.poker_tables (updated_at desc)
  where is_public and status <> 'closed';

-- Lobby list of open public tables. Seat count is read from the stored state
-- jsonb (the players array); this never exposes any hidden card data.
create or replace function public.list_public_poker_tables()
  returns table (
    table_id  bigint,
    code      text,
    status    text,
    host_name text,
    buy_in    bigint,
    seats     int,
    max_seats int
  )
  language sql stable security definer set search_path = public, extensions as $$
  select t.id,
         t.code,
         t.status,
         coalesce(p.display_name, 'Anfitrião'),
         t.buy_in,
         coalesce(jsonb_array_length(t.state -> 'players'), 0),
         9
    from public.poker_tables t
    left join public.profiles p on p.id = t.host_id
   where t.is_public and t.status <> 'closed'
   order by t.updated_at desc
   limit 50;
$$;
revoke all on function public.list_public_poker_tables() from public;
grant execute on function public.list_public_poker_tables() to authenticated;
