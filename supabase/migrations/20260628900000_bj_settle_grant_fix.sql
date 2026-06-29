-- ============================================================================
-- Arentim — SECURITY FIX (CRITICAL): lock down blackjack helper functions.
--
-- bj_settle(blackjack_hands) is SECURITY DEFINER and credits profiles.balance
-- for h.user_id from a *composite argument* — the caller supplies the user id,
-- the stakes, the cards and the dealer. Its siblings bj_deal/bj_action/bj_current
-- correctly `revoke ... from public` + `grant ... to authenticated`, but
-- bj_settle (and the bj_* helpers) were never revoked, so PostgreSQL's default
-- EXECUTE-to-PUBLIC grant stood. That let ANY logged-in user call
--   rpc('bj_settle', { h: { user_id:<self>, hands:[{stake:1e9,...win...}], ... }})
-- and mint unlimited balance to any account.
--
-- Fix: revoke EXECUTE on bj_settle and the helper functions. They are only ever
-- called from inside bj_deal/bj_action, which run as SECURITY DEFINER and
-- execute these under the OWNER role regardless of these grants, so legitimate
-- play is unaffected. They are intentionally NOT granted to anon/authenticated —
-- there is no legitimate direct client call.
--
-- NB: Supabase grants EXECUTE on every new public function to anon + authenticated
-- EXPLICITLY (via ALTER DEFAULT PRIVILEGES), on top of the implicit PUBLIC grant.
-- Revoking only from PUBLIC therefore does NOT close the hole — we must also
-- revoke the explicit anon/authenticated grants. (service_role/postgres keep it;
-- neither is reachable from a browser client.)
-- ============================================================================

revoke all on function public.bj_settle(public.blackjack_hands) from public, anon, authenticated;
revoke all on function public.bj_view(public.blackjack_hands)   from public, anon, authenticated;
revoke all on function public.bj_card_value(integer)            from public, anon, authenticated;
revoke all on function public.bj_total(integer[])               from public, anon, authenticated;
revoke all on function public.bj_ints(jsonb)                    from public, anon, authenticated;

-- Guard against regressions: assert the balance-crediting settler is no longer
-- EXECUTE-able by the client roles.
do $$
begin
  if has_function_privilege('authenticated', 'public.bj_settle(public.blackjack_hands)', 'execute')
     or has_function_privilege('anon', 'public.bj_settle(public.blackjack_hands)', 'execute') then
    raise exception 'bj_settle is still EXECUTE-able by anon/authenticated — revoke failed';
  end if;
end $$;
