-- ============================================================================
-- Arentim — admin: grant/revoke admin role, and bulk give/take Tostões.
-- Both re-check is_admin() server-side and write an admin_actions audit row.
-- ============================================================================

-- ---- Promote / demote an admin ---------------------------------------------
-- You can't change your own role (no self-lockout, no self-promote loops).
create or replace function public.admin_set_admin(p_user uuid, p_is_admin boolean, p_reason text)
  returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = 'check_violation';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot change your own admin role' using errcode = 'check_violation';
  end if;
  update public.profiles set is_admin = p_is_admin where id = p_user;
  if not found then raise exception 'user not found'; end if;
  perform public.admin_audit(p_user, case when p_is_admin then 'grant_admin' else 'revoke_admin' end,
                             jsonb_build_object('reason', p_reason));
end; $$;
revoke all on function public.admin_set_admin(uuid, boolean, text) from public;
grant execute on function public.admin_set_admin(uuid, boolean, text) to authenticated;

-- ---- Bulk give / take Tostões ----------------------------------------------
-- Credits (or debits, clamped at 0) every player in scope via ledger
-- 'adjustment' rows so the ledger stays reconciled. scope: 'all' | 'active'
-- (online in the last 7 days). Returns how many balances changed.
create or replace function public.admin_bulk_grant(p_amount bigint, p_reason text, p_scope text default 'all')
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_count int;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = 'check_violation';
  end if;
  if p_amount = 0 or abs(p_amount) > 1000000000 then
    raise exception 'invalid amount' using errcode = 'check_violation';
  end if;
  if p_scope not in ('all', 'active') then
    raise exception 'invalid scope' using errcode = 'check_violation';
  end if;

  -- Lock the target rows first so a concurrent bet can't desync balance_after.
  perform 1 from public.profiles
   where (p_scope = 'all' or last_online >= now() - interval '7 days')
   for update;

  -- Ledger rows (only where the balance actually moves), then the matching
  -- balance update. 'adjustment' is exempt from the suspended-user trigger.
  insert into public.transactions (user_id, type, amount, balance_after, note)
  select id, 'adjustment',
         greatest(0, balance + p_amount) - balance,
         greatest(0, balance + p_amount),
         format('Distribuição em massa: %s', p_reason)
    from public.profiles
   where (p_scope = 'all' or last_online >= now() - interval '7 days')
     and greatest(0, balance + p_amount) - balance <> 0;
  get diagnostics v_count = row_count;

  update public.profiles
     set balance = greatest(0, balance + p_amount)
   where (p_scope = 'all' or last_online >= now() - interval '7 days')
     and greatest(0, balance + p_amount) <> balance;

  perform public.admin_audit(null, 'bulk_grant',
    jsonb_build_object('amount', p_amount, 'scope', p_scope, 'reason', p_reason, 'count', v_count));
  return jsonb_build_object('count', v_count);
end; $$;
revoke all on function public.admin_bulk_grant(bigint, text, text) from public;
grant execute on function public.admin_bulk_grant(bigint, text, text) to authenticated;
