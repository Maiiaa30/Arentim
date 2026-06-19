-- ============================================================================
-- Arentim — social lookups: username availability + public player card.
--
-- profiles are private (own-row RLS), so these SECURITY DEFINER functions
-- expose only the minimum needed: a yes/no for username availability (used at
-- sign-up, before auth) and a safe public stat card for the leaderboard popup
-- (no balance, no email).
-- ============================================================================

-- Is a display name free? Case-insensitive. Callable pre-auth (sign-up).
create or replace function public.username_available(p_name text)
  returns boolean
  language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.profiles
     where lower(display_name) = lower(trim(p_name))
  );
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Safe public profile + the caller's friendship status toward that user.
create or replace function public.public_profile(p_user uuid)
  returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.profiles;
  v_status text := 'none';
begin
  select * into v_p from public.profiles where id = p_user;
  if not found then return null; end if;

  if p_user = auth.uid() then
    v_status := 'self';
  elsif exists (
    select 1 from public.friendships f
     where f.status = 'accepted'
       and ((f.requester = auth.uid() and f.addressee = p_user)
         or (f.requester = p_user and f.addressee = auth.uid()))
  ) then
    v_status := 'friends';
  elsif exists (
    select 1 from public.friendships f
     where f.status = 'pending' and f.requester = auth.uid() and f.addressee = p_user
  ) then
    v_status := 'pending_out';
  elsif exists (
    select 1 from public.friendships f
     where f.status = 'pending' and f.requester = p_user and f.addressee = auth.uid()
  ) then
    v_status := 'pending_in';
  end if;

  return jsonb_build_object(
    'id', v_p.id,
    'display_name', v_p.display_name,
    'avatar_url', v_p.avatar_url,
    'games_played', v_p.games_played,
    'games_won', v_p.games_won,
    'biggest_win', v_p.biggest_win,
    'total_won', v_p.total_won,
    'total_lost', v_p.total_lost,
    'streak_count', v_p.streak_count,
    'created_at', v_p.created_at,
    'last_online', v_p.last_online,
    'friend_status', v_status
  );
end; $$;
revoke all on function public.public_profile(uuid) from public;
grant execute on function public.public_profile(uuid) to authenticated;
