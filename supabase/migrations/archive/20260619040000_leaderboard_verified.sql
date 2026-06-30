-- Arentim — leaderboard: only fully-registered (email-confirmed) accounts.
-- Re-defines public.leaderboard with the same signature and return shape,
-- but excludes any profile whose auth.users.email_confirmed_at IS NULL.

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
     where (
             p_scope = 'global'
          or p.id = auth.uid()
          or p.id in (
            select case when f.requester = auth.uid() then f.addressee else f.requester end
              from public.friendships f
             where f.status = 'accepted' and (f.requester = auth.uid() or f.addressee = auth.uid())
          )
         )
       and exists (
            select 1 from auth.users u
             where u.id = p.id
               and u.email_confirmed_at is not null
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
