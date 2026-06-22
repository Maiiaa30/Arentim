-- Live match stats (cached) + "Onde ver" official broadcaster listings.
--
-- live_stats: cached per-team live statistics (possession, shots, …) fetched
--   on-demand by the `match-stats` Edge Function from a stats provider
--   (API-Football). stats_ref caches the provider's fixture id once matched, so
--   we only resolve the team-name match once per fixture.
-- broadcasts: admin-curated OFFICIAL broadcaster per competition, shown in the
--   match popup as "Onde ver". No third-party streams — just where to watch.
alter table public.fixtures add column if not exists live_stats jsonb not null default '{}'::jsonb;
alter table public.fixtures add column if not exists stats_ref text;

-- ---- Broadcasts (Onde ver) --------------------------------------------------
create table if not exists public.broadcasts (
  league     text primary key,
  channel    text not null,
  url        text,
  updated_at timestamptz not null default now()
);
alter table public.broadcasts enable row level security;
-- Read via the RPC below; writes only through the admin RPC.

-- Sensible PT-market defaults; admins correct them in the panel. Keys match the
-- fixture.league values synced by footballData.ts (FD_COMPETITIONS names).
insert into public.broadcasts (league, channel, url) values
  ('Liga Portugal', 'Sport TV', 'https://www.sporttv.pt'),
  ('Liga dos Campeões', 'DAZN / TVI', 'https://www.dazn.com/pt-PT'),
  ('Premier League', 'DAZN', 'https://www.dazn.com/pt-PT'),
  ('La Liga', 'DAZN', 'https://www.dazn.com/pt-PT'),
  ('Serie A', 'DAZN', 'https://www.dazn.com/pt-PT'),
  ('Bundesliga', 'DAZN', 'https://www.dazn.com/pt-PT'),
  ('Campeonato do Mundo', 'RTP', 'https://www.rtp.pt')
on conflict (league) do nothing;

create or replace function public.list_broadcasts()
  returns table (league text, channel text, url text)
  language sql stable security definer set search_path = public as $$
  select b.league, b.channel, b.url from public.broadcasts b order by b.league;
$$;
revoke all on function public.list_broadcasts() from public;
grant execute on function public.list_broadcasts() to authenticated;

create or replace function public.admin_set_broadcast(p_league text, p_channel text, p_url text)
  returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(trim(p_channel), '') = '' then
    delete from public.broadcasts where league = p_league;
  else
    insert into public.broadcasts (league, channel, url, updated_at)
    values (p_league, p_channel, nullif(trim(p_url), ''), now())
    on conflict (league) do update
      set channel = excluded.channel, url = excluded.url, updated_at = now();
  end if;
  perform public.admin_audit(null, 'set_broadcast', jsonb_build_object('league', p_league, 'channel', p_channel));
end; $$;
revoke all on function public.admin_set_broadcast(text, text, text) from public;
grant execute on function public.admin_set_broadcast(text, text, text) to authenticated;
