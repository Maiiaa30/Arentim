-- Public Sueca tables — mirror of public poker tables.
--
-- A table can be flagged public: it keeps its join code but also shows up in a
-- lobby so anyone can browse open tables and sit at a free seat. Private tables
-- (the default) stay code-only.
alter table public.sueca_tables
  add column if not exists is_public boolean not null default false;

create index if not exists sueca_tables_public_idx
  on public.sueca_tables (updated_at desc)
  where is_public and status = 'open';

-- Lobby list of open public tables (only 'open' ones are joinable). Member count
-- comes from sueca_table_members; no hidden card state is exposed.
create or replace function public.list_public_sueca_tables()
  returns table (
    table_id  bigint,
    code      text,
    status    text,
    host_name text,
    players   int
  )
  language sql stable security definer set search_path = public, extensions as $$
  select t.id,
         t.code,
         t.status,
         coalesce(p.display_name, 'Anfitrião'),
         (select count(*)::int from public.sueca_table_members m where m.table_id = t.id)
    from public.sueca_tables t
    left join public.profiles p on p.id = t.host_id
   where t.is_public and t.status = 'open'
   order by t.updated_at desc
   limit 50;
$$;
revoke all on function public.list_public_sueca_tables() from public;
grant execute on function public.list_public_sueca_tables() to authenticated;
