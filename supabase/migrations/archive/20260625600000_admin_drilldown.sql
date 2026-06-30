-- ============================================================================
-- Arentim — admin player drill-down + announcement management (read RPCs).
--
-- All functions are SECURITY DEFINER and re-check is_admin() server-side
-- (mirroring the existing admin RPC guards). Public is revoked; only the
-- authenticated role may call them, and the body enforces the admin gate.
-- ============================================================================

-- Recent ledger for one player (Transações tab).
create or replace function public.admin_player_transactions(p_user uuid, p_limit int default 30)
  returns table (
    id bigint, type text, game text, amount bigint,
    balance_after bigint, note text, created_at timestamptz
  )
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select t.id, t.type::text, t.game, t.amount, t.balance_after, t.note, t.created_at
      from public.transactions t
     where t.user_id = p_user
     order by t.created_at desc
     limit greatest(1, least(coalesce(p_limit, 30), 200));
end; $$;
revoke all on function public.admin_player_transactions(uuid, int) from public;
grant execute on function public.admin_player_transactions(uuid, int) to authenticated;

-- Recent sports bets for one player (Apostas tab).
create or replace function public.admin_player_bets(p_user uuid, p_limit int default 20)
  returns table (
    id bigint, stake bigint, combined_odds numeric, potential_payout bigint,
    status text, created_at timestamptz
  )
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select b.id, b.stake, b.combined_odds, b.potential_payout, b.status::text, b.created_at
      from public.bets b
     where b.user_id = p_user
     order by b.created_at desc
     limit greatest(1, least(coalesce(p_limit, 20), 200));
end; $$;
revoke all on function public.admin_player_bets(uuid, int) from public;
grant execute on function public.admin_player_bets(uuid, int) to authenticated;

-- All announcements (Anúncios → Ativos list).
create or replace function public.admin_announcements()
  returns table (
    id bigint, title text, body text, active boolean, created_at timestamptz
  )
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select a.id, a.title, a.body, a.active, a.created_at
      from public.announcements a
     order by a.created_at desc;
end; $$;
revoke all on function public.admin_announcements() from public;
grant execute on function public.admin_announcements() to authenticated;

-- Toggle an announcement active/inactive.
create or replace function public.admin_set_announcement_active(p_id bigint, p_active boolean)
  returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.announcements set active = p_active where id = p_id;
  perform public.admin_audit(null, 'set_announcement_active',
    jsonb_build_object('id', p_id, 'active', p_active));
end; $$;
revoke all on function public.admin_set_announcement_active(bigint, boolean) from public;
grant execute on function public.admin_set_announcement_active(bigint, boolean) to authenticated;
