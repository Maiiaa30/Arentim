-- ============================================================================
-- Arentim — admin dashboard stats + temporary suspensions.
--
--   * admin_stats(): one round-trip KPI snapshot for the admin overview
--     (users, signups, active/online, money in circulation, wagering, bets).
--     SECURITY DEFINER + is_admin() gate; reads aggregates only.
--   * suspended_until: a timed block that auto-expires (no manual unsuspend
--     needed). Effective suspension = permanent flag OR an unexpired timer.
-- ============================================================================

alter table public.profiles add column if not exists suspended_until timestamptz;

-- ---- Suspension enforcement now also honours a temporary timer ---------------
create or replace function public.enforce_not_suspended()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type <> 'adjustment'
     and exists (
       select 1 from public.profiles p
        where p.id = new.user_id
          and (p.suspended or (p.suspended_until is not null and p.suspended_until > now()))
     ) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  return new;
end; $$;

-- Un-suspending also clears any pending temporary timer.
create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_reason text)
  returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.profiles
     set suspended = p_suspended,
         suspended_until = case when p_suspended then suspended_until else null end
   where id = p_user;
  perform public.admin_audit(p_user, case when p_suspended then 'suspend' else 'unsuspend' end,
                             jsonb_build_object('reason', p_reason));
end; $$;
revoke all on function public.admin_set_suspended(uuid, boolean, text) from public;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;

-- Temporary block for N minutes (auto-expires); 0/negative lifts the timer.
create or replace function public.admin_suspend_until(p_user uuid, p_minutes integer, p_reason text)
  returns timestamptz language plpgsql volatile security definer set search_path = public as $$
declare v_until timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  v_until := case when p_minutes > 0 then now() + (p_minutes || ' minutes')::interval else null end;
  update public.profiles set suspended_until = v_until where id = p_user;
  perform public.admin_audit(p_user, 'suspend_temp',
    jsonb_build_object('minutes', p_minutes, 'until', v_until, 'reason', p_reason));
  return v_until;
end; $$;
revoke all on function public.admin_suspend_until(uuid, integer, text) from public;
grant execute on function public.admin_suspend_until(uuid, integer, text) to authenticated;

-- ---- KPI snapshot for the admin overview -----------------------------------
create or replace function public.admin_stats()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users_total',        (select count(*) from public.profiles),
    'users_new_today',    (select count(*) from public.profiles where created_at >= date_trunc('day', now())),
    'users_new_7d',       (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'online_now',         (select count(*) from public.profiles where last_online >= now() - interval '5 minutes'),
    'active_24h',         (select count(*) from public.profiles where last_online >= now() - interval '24 hours'),
    'active_7d',          (select count(*) from public.profiles where last_online >= now() - interval '7 days'),
    'suspended',          (select count(*) from public.profiles where suspended or (suspended_until is not null and suspended_until > now())),
    'admins',             (select count(*) from public.profiles where is_admin),
    'bettors',            (select count(*) from public.profiles where total_wagered > 0),
    'balance_total',      (select coalesce(sum(balance), 0) from public.profiles),
    'wagered_total',      (select coalesce(sum(total_wagered), 0) from public.profiles),
    'won_total',          (select coalesce(sum(total_won), 0) from public.profiles),
    'games_total',        (select coalesce(sum(games_played), 0) from public.profiles),
    'sports_bets_total',  (select count(*) from public.bets),
    'sports_bets_today',  (select count(*) from public.bets where created_at >= date_trunc('day', now())),
    'sports_bets_open',   (select count(*) from public.bets where status = 'pending'),
    'sports_stake_total', (select coalesce(sum(stake), 0) from public.bets),
    'top_balances',       (select coalesce(jsonb_agg(t), '[]'::jsonb) from
                            (select id, display_name, balance from public.profiles order by balance desc limit 6) t),
    'top_wagered',        (select coalesce(jsonb_agg(t), '[]'::jsonb) from
                            (select id, display_name, total_wagered from public.profiles where total_wagered > 0 order by total_wagered desc limit 6) t),
    'recent_signups',     (select coalesce(jsonb_agg(t), '[]'::jsonb) from
                            (select id, display_name, created_at from public.profiles order by created_at desc limit 6) t)
  );
end; $$;
revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;
