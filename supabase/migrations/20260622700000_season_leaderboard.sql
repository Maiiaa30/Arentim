-- ============================================================================
-- Arentim — SEASON leaderboard. The lifetime `leaderboard` never resets; this
-- ranks gaming net P&L within the CURRENT calendar month (resets on the 1st).
-- Net = sum of win/bet/refund ledger amounts since the month start (bet is
-- negative). Gifts/bonuses/admin adjustments are excluded — pure gaming result.
-- Duel bet/win/refund rows count (they're real wagers).
-- ============================================================================

create or replace function public.season_leaderboard(p_scope text)
  returns table (id uuid, display_name text, avatar_url text, value bigint, is_me boolean)
  language plpgsql stable security definer set search_path = public
as $$
declare
  v_start timestamptz := date_trunc('month', now());
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
    -- Global view: only players with activity this season; friends view: always show friends.
    left join net on net.user_id = pool.id
   where p_scope = 'friends' or net.user_id is not null
   order by value desc
   limit 50;
end; $$;
revoke all on function public.season_leaderboard(text) from public;
grant execute on function public.season_leaderboard(text) to authenticated;
