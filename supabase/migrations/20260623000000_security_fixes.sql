-- ============================================================================
-- Arentim — security hardening (audit follow-up).
--
-- Fixes guaranteed-win RLS leaks and over-broad client write access. The
-- frontend reads NONE of these tables directly (verified) — all access is via
-- SECURITY DEFINER RPCs / Edge Functions, which bypass RLS — so tightening the
-- client-facing policies changes no legitimate behaviour.
-- ============================================================================

-- C1 (CRITICAL) — per-user Crash leaked the hidden crash_point.
-- crash_rounds.crash_point is drawn at start; the own-row SELECT policy let a
-- client read it over PostgREST and then cash out just below it (guaranteed win).
-- Reads of a LIVE round must go through crash_state (which masks it). Restrict
-- the policy to SETTLED rows only.
drop policy if exists crash_rounds_select_own on public.crash_rounds;
create policy crash_rounds_select_own on public.crash_rounds
  for select to authenticated using (user_id = auth.uid() and settled);

-- C2 (CRITICAL) — Jogo dos Copos leaked the winning cup.
-- cups_rounds.prize is the ball position; the own-row SELECT policy let a client
-- read it and pick it for a guaranteed 2.85×. The client never needs to read the
-- table (cups_start returns the swap sequence, cups_pick returns the result).
drop policy if exists cups_rounds_select_own on public.cups_rounds;

-- H2 (HIGH) — Sueca exposed every player's hand.
-- sueca_tables.state holds the full deck + all seats' hands; the member SELECT
-- policy let a seated player read opponents' cards over PostgREST, bypassing the
-- per-seat view the Edge Function serves. Hide the column from clients (the row
-- stays readable for the non-sensitive summary columns; list_my_sueca_tables and
-- the Edge Function are unaffected).
revoke select (state) on public.sueca_tables from authenticated;

-- M2 (MEDIUM) — notifications allowed clients to UPDATE any column.
-- The only legitimate client mutation is mark-as-read, which goes through the
-- mark_notifications_read RPC (SECURITY DEFINER). Drop the broad UPDATE policy so
-- clients can't rewrite title/body/link/data or backdate rows (which also feed
-- the realtime stream).
drop policy if exists notifications_update_own on public.notifications;

-- M3 (MEDIUM) — suspended users could still move money via gifts.
-- gift_tos writes both legs as type 'adjustment', which enforce_not_suspended
-- waives through (so admins can adjust suspended accounts). Add an explicit guard
-- so a suspended sender is blocked.
create or replace function public.gift_tos(p_to uuid, p_amount bigint)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_from_balance bigint; v_from_after bigint; v_to_balance bigint; v_to_after bigint;
  v_from_name text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_to = v_uid then raise exception 'não te podes presentear' using errcode = 'check_violation'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    raise exception 'montante inválido' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.friendships
     where status = 'accepted'
       and ((requester = v_uid and addressee = p_to) or (requester = p_to and addressee = v_uid))
  ) then
    raise exception 'só podes presentear amigos' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('gift_tos'));

  select balance, display_name into v_from_balance, v_from_name from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_from_balance < p_amount then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_from_after := v_from_balance - p_amount;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'adjustment', null, -p_amount, v_from_after, 'presente enviado');
  update public.profiles set balance = v_from_after where id = v_uid;

  select balance into v_to_balance from public.profiles where id = p_to for update;
  if not found then raise exception 'destinatário não encontrado' using errcode = 'check_violation'; end if;
  v_to_after := v_to_balance + p_amount;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (p_to, 'adjustment', null, p_amount, v_to_after, format('presente de %s', coalesce(v_from_name, 'um amigo')));
  update public.profiles set balance = v_to_after where id = p_to;

  insert into public.notifications (user_id, type, title, body, link, data)
  values (p_to, 'gift', 'Recebeste um presente',
          coalesce(v_from_name, 'Um amigo') || ' enviou-te ' || p_amount || ' tós', '/friends',
          jsonb_build_object('from', v_uid, 'amount', p_amount));

  return jsonb_build_object('balance', v_from_after, 'amount', p_amount);
end; $$;
revoke all on function public.gift_tos(uuid, bigint) from public;
grant execute on function public.gift_tos(uuid, bigint) to authenticated;

-- M1 (MEDIUM) — re-run the "every public table has RLS enabled" assertion HERE
-- (the original ran early and never covered tables added afterwards).
do $$
declare r record;
begin
  for r in
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise exception 'SECURITY: table public.% has RLS disabled', r.relname;
  end loop;
end $$;
