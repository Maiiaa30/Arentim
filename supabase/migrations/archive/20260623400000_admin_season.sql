-- ============================================================================
-- Arentim — configurable season + admin reset.
--
-- The season board defaulted to the calendar month. Store an explicit season
-- start so an admin can reset it on demand ("Repor temporada"); the board reads
-- that start instead of date_trunc('month', now()).
-- ============================================================================

create table if not exists public.season_config (
  id         int primary key default 1 check (id = 1),
  started_at timestamptz not null default date_trunc('month', now())
);
insert into public.season_config (id, started_at)
values (1, date_trunc('month', now()))
on conflict (id) do nothing;

alter table public.season_config enable row level security;
drop policy if exists season_config_read on public.season_config;
create policy season_config_read on public.season_config
  for select to authenticated using (true);

-- Admin-only reset: stamp the season start to now and audit it.
create or replace function public.admin_reset_season()
  returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_now timestamptz := now();
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.season_config set started_at = v_now where id = 1;
  insert into public.admin_actions (admin_id, action, detail)
  values (auth.uid(), 'reset_season', jsonb_build_object('at', v_now));
  return v_now;
end; $$;
revoke all on function public.admin_reset_season() from public;
grant execute on function public.admin_reset_season() to authenticated;

-- Re-point season_leaderboard at the configured season start.
create or replace function public.season_leaderboard(p_scope text)
  returns table (id uuid, display_name text, avatar_url text, value bigint, is_me boolean)
  language plpgsql stable security definer set search_path = public
as $$
declare
  v_start timestamptz := coalesce(
    (select started_at from public.season_config where id = 1),
    date_trunc('month', now())
  );
begin
  if p_scope not in ('global', 'friends') then
    raise exception 'invalid scope' using errcode = 'check_violation';
  end if;

  return query
  with pool as (
    select p.id, p.display_name, p.avatar_url
      from public.profiles p
     where p_scope = 'global'
        or p.id = auth.uid()
        or p.id in (
          select case when f.requester = auth.uid() then f.addressee else f.requester end
            from public.friendships f
           where f.status = 'accepted' and (f.requester = auth.uid() or f.addressee = auth.uid())
        )
  ),
  net as (
    select t.user_id, coalesce(sum(t.amount), 0)::bigint as v
      from public.transactions t
     where t.created_at >= v_start and t.type in ('win', 'bet', 'refund')
     group by t.user_id
  )
  select pool.id, pool.display_name, pool.avatar_url,
         coalesce(net.v, 0) as value,
         (pool.id = auth.uid()) as is_me
    from pool
    left join net on net.user_id = pool.id
   where p_scope = 'friends' or net.user_id is not null
   order by value desc
   limit 50;
end; $$;
revoke all on function public.season_leaderboard(text) from public;
grant execute on function public.season_leaderboard(text) to authenticated;
