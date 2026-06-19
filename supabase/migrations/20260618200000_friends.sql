-- ============================================================================
-- Arentim — Phase 9: friends + leaderboards.
--
-- Profiles are private (own-row RLS), so social reads go through SECURITY
-- DEFINER functions that expose only safe, limited columns (no email, no
-- internal ids beyond what's needed). All mutations are scoped to auth.uid().
-- ============================================================================

create table if not exists public.friendships (
  id         bigint generated always as identity primary key,
  requester  uuid not null references public.profiles (id) on delete cascade,
  addressee  uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester <> addressee),
  unique (requester, addressee)
);

create index if not exists friendships_addressee_idx on public.friendships (addressee, status);
create index if not exists friendships_requester_idx on public.friendships (requester, status);

alter table public.friendships enable row level security;

drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own on public.friendships
  for select to authenticated
  using (requester = auth.uid() or addressee = auth.uid() or public.is_admin());

-- ---- Search (limited columns) ----------------------------------------------
create or replace function public.search_users(p_query text)
  returns table (id uuid, display_name text, avatar_url text)
  language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url
    from public.profiles p
   where p.id <> auth.uid()
     and p.display_name ilike '%' || p_query || '%'
   order by p.display_name
   limit 10;
$$;
revoke all on function public.search_users(text) from public;
grant execute on function public.search_users(text) to authenticated;

-- ---- Send / respond / remove -----------------------------------------------
create or replace function public.send_friend_request(p_addressee uuid)
  returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_existing public.friendships;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_addressee = v_uid then raise exception 'cannot friend yourself' using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.profiles where id = p_addressee) then
    raise exception 'user not found' using errcode = 'check_violation';
  end if;

  -- Already connected either way?
  select * into v_existing from public.friendships
   where (requester = v_uid and addressee = p_addressee)
      or (requester = p_addressee and addressee = v_uid);
  if found then
    if v_existing.status = 'accepted' then return 'already_friends'; end if;
    -- They already invited us → accept it.
    if v_existing.requester = p_addressee and v_existing.status = 'pending' then
      update public.friendships set status = 'accepted', updated_at = now() where id = v_existing.id;
      return 'accepted';
    end if;
    if v_existing.status = 'pending' then return 'already_requested'; end if;
    -- Previously declined → refresh as a new request from us.
    update public.friendships
       set requester = v_uid, addressee = p_addressee, status = 'pending', updated_at = now()
     where id = v_existing.id;
    return 'requested';
  end if;

  insert into public.friendships (requester, addressee) values (v_uid, p_addressee);
  return 'requested';
end; $$;
revoke all on function public.send_friend_request(uuid) from public;
grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.respond_friend_request(p_request_id bigint, p_accept boolean)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  update public.friendships
     set status = case when p_accept then 'accepted' else 'declined' end, updated_at = now()
   where id = p_request_id and addressee = v_uid and status = 'pending';
  if not found then raise exception 'request not found' using errcode = 'check_violation'; end if;
end; $$;
revoke all on function public.respond_friend_request(bigint, boolean) from public;
grant execute on function public.respond_friend_request(bigint, boolean) to authenticated;

create or replace function public.remove_friend(p_other uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  delete from public.friendships
   where ((requester = v_uid and addressee = p_other) or (requester = p_other and addressee = v_uid));
end; $$;
revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ---- Reads: friends list + pending requests --------------------------------
create or replace function public.list_friends()
  returns table (
    id uuid, display_name text, avatar_url text, balance bigint,
    total_wagered bigint, total_won bigint, total_lost bigint,
    games_played int, games_won int, biggest_win bigint, streak_count int,
    last_online timestamptz
  )
  language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, p.balance,
         p.total_wagered, p.total_won, p.total_lost,
         p.games_played, p.games_won, p.biggest_win, p.streak_count, p.last_online
    from public.friendships f
    join public.profiles p
      on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
   where f.status = 'accepted' and (f.requester = auth.uid() or f.addressee = auth.uid())
   order by p.display_name;
$$;
revoke all on function public.list_friends() from public;
grant execute on function public.list_friends() to authenticated;

create or replace function public.list_friend_requests()
  returns table (id bigint, direction text, other_id uuid, display_name text, avatar_url text, created_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select f.id,
         case when f.addressee = auth.uid() then 'incoming' else 'outgoing' end as direction,
         case when f.addressee = auth.uid() then f.requester else f.addressee end as other_id,
         p.display_name, p.avatar_url, f.created_at
    from public.friendships f
    join public.profiles p
      on p.id = case when f.addressee = auth.uid() then f.requester else f.addressee end
   where f.status = 'pending' and (f.requester = auth.uid() or f.addressee = auth.uid())
   order by f.created_at desc;
$$;
revoke all on function public.list_friend_requests() from public;
grant execute on function public.list_friend_requests() to authenticated;

-- ---- Leaderboards ----------------------------------------------------------
-- scope: 'global' | 'friends'; metric: 'net' | 'biggest_win' | 'streak'
create or replace function public.leaderboard(p_scope text, p_metric text)
  returns table (id uuid, display_name text, avatar_url text, value bigint, is_me boolean)
  language plpgsql stable security definer set search_path = public as $$
begin
  if p_metric not in ('net', 'biggest_win', 'streak') then
    raise exception 'invalid metric' using errcode = 'check_violation';
  end if;
  if p_scope not in ('global', 'friends') then
    raise exception 'invalid scope' using errcode = 'check_violation';
  end if;

  return query
  with pool as (
    select p.* from public.profiles p
     where p_scope = 'global'
        or p.id = auth.uid()
        or p.id in (
          select case when f.requester = auth.uid() then f.addressee else f.requester end
            from public.friendships f
           where f.status = 'accepted' and (f.requester = auth.uid() or f.addressee = auth.uid())
        )
  )
  select pool.id, pool.display_name, pool.avatar_url,
         (case p_metric
            when 'net' then pool.total_won - pool.total_lost
            when 'biggest_win' then pool.biggest_win
            else pool.streak_count::bigint end) as value,
         (pool.id = auth.uid()) as is_me
    from pool
   order by value desc
   limit 50;
end; $$;
revoke all on function public.leaderboard(text, text) from public;
grant execute on function public.leaderboard(text, text) to authenticated;
