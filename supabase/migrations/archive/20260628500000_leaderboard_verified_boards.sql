-- ============================================================================
-- Arentim — bettor boards: verified accounts only (+ drop never-played junk).
--
-- "Grandes Apostadores" (home, public.leaderboard) and the sportsbook "Tabela de
-- Apostadores" (public.football_leaderboard) were showing throwaway/unconfirmed
-- test accounts. leaderboard already required email_confirmed_at, but
-- football_leaderboard had NO such filter. This re-affirms the filter on
-- leaderboard (so it's guaranteed live), adds an activity gate (must have
-- actually wagered) so empty test signups drop off, and applies the same
-- email-confirmed requirement to football_leaderboard. Idempotent.
-- ============================================================================

-- ---- Home "Grandes Apostadores" -------------------------------------------
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
       -- Only fully-registered (email-confirmed) accounts.
       and exists (
            select 1 from auth.users u
             where u.id = p.id and u.email_confirmed_at is not null
         )
       -- Drop never-played throwaways (a "big bettors" board needs real activity).
       -- The caller's own row is always kept so you can see yourself.
       and (p.total_wagered > 0 or p.id = auth.uid())
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

-- ---- Sportsbook "Tabela de Apostadores" -----------------------------------
create or replace function public.football_leaderboard()
  returns jsonb language sql stable security definer
  set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', q.id, 'name', q.display_name,
             'wagered', q.wagered, 'won', q.won, 'lost', q.lost, 'net', q.net, 'bets', q.bets)
           order by q.wagered desc), '[]'::jsonb)
  from (
    select p.id, p.display_name,
           sum(b.stake)::bigint as wagered,
           sum(case when b.status = 'won' then b.potential_payout else 0 end)::bigint as won,
           sum(case when b.status = 'lost' then b.stake else 0 end)::bigint as lost,
           (sum(case when b.status = 'won' then b.potential_payout else 0 end)
            - sum(case when b.status in ('won', 'lost') then b.stake else 0 end))::bigint as net,
           count(*)::int as bets
    from public.bets b
    join public.profiles p on p.id = b.user_id
    -- Verified accounts only (match the home board).
    where exists (
      select 1 from auth.users u where u.id = p.id and u.email_confirmed_at is not null
    )
    group by p.id, p.display_name
    limit 100
  ) q;
$$;
revoke all on function public.football_leaderboard() from public;
grant execute on function public.football_leaderboard() to authenticated;
