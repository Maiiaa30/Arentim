-- ============================================================================
-- Arentim — gift Tostões to a friend. An atomic transfer between two profiles:
-- debits the sender, credits the recipient, writes a ledger row on both sides
-- and drops a notification. Serialized by a single advisory lock (deadlock-free)
-- — fine for a friends-group scale. Only accepted friends, capped per gift.
-- ============================================================================

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
