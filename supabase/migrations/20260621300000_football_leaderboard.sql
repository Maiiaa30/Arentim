-- ============================================================================
-- Arentim — football betting leaderboard. Aggregates the sportsbook `bets` table
-- per user (most wagered / most won / most lost / net). SECURITY DEFINER so it
-- can read across users (RLS limits direct reads to own bets); it exposes only
-- display names + totals, no bet detail.
-- ============================================================================

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
    group by p.id, p.display_name
    limit 100
  ) q;
$$;
revoke all on function public.football_leaderboard() from public;
grant execute on function public.football_leaderboard() to authenticated;
