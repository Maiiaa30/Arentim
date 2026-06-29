-- ============================================================================
-- Arentim — lightweight per-user rate limiting (abuse / spam prevention).
--
-- A tiny append-only log + a SECURITY DEFINER helper that records a hit and
-- reports whether the user is under the cap for an action in a time window.
-- Used by edge functions (service role) for things like invite emails. RLS on,
-- no client policies — only definer functions / service role touch it.
-- ============================================================================

create table if not exists public.rate_limits (
  user_id uuid not null references public.profiles (id) on delete cascade,
  action  text not null,
  ts      timestamptz not null default now()
);
create index if not exists rate_limits_lookup_idx on public.rate_limits (user_id, action, ts);
alter table public.rate_limits enable row level security;

-- Record a hit and return true if the user is still under p_max in the last
-- p_window_secs seconds, false if they've hit the cap (then nothing is recorded).
create or replace function public.rate_limit_hit(p_user uuid, p_action text, p_max int, p_window_secs int)
  returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_count int;
begin
  delete from public.rate_limits where ts < now() - interval '1 day'; -- light GC
  select count(*) into v_count from public.rate_limits
   where user_id = p_user and action = p_action and ts > now() - make_interval(secs => p_window_secs);
  if v_count >= p_max then return false; end if;
  insert into public.rate_limits (user_id, action) values (p_user, p_action);
  return true;
end; $$;
revoke all on function public.rate_limit_hit(uuid, text, int, int) from public;
-- Only the service role (edge functions) calls this — not granted to clients.

-- ---- Rate-limit gift_tos (max 20 gifts/hour) -------------------------------
-- Re-create with an extra cap up front; everything else is unchanged.
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
  -- Anti-spam: cap gifts per sender per hour.
  if (select count(*) from public.transactions
        where user_id = v_uid and type = 'adjustment' and note = 'presente enviado'
          and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'demasiados presentes — espera um pouco' using errcode = 'check_violation';
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
