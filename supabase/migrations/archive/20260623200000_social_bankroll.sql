-- ============================================================================
-- Arentim — social + bankroll RPCs.
--   request_tos  — ask a friend for Tostões (drops a 'gift_request' notification;
--                  no money moves — the friend gifts via the existing gift_tos).
--   duel_record  — head-to-head settled-duel tally between the caller and a friend
--                  (powers the public PlayerCard).
-- ============================================================================

create or replace function public.request_tos(p_from uuid, p_amount bigint)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_name text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_from = v_uid then raise exception 'não te podes pedir a ti' using errcode = 'check_violation'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    raise exception 'montante inválido' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.friendships
     where status = 'accepted'
       and ((requester = v_uid and addressee = p_from) or (requester = p_from and addressee = v_uid))
  ) then
    raise exception 'só podes pedir a amigos' using errcode = 'check_violation';
  end if;
  select display_name into v_name from public.profiles where id = v_uid;
  insert into public.notifications (user_id, type, title, body, link, data)
  values (p_from, 'gift_request', 'Pedido de Tostões',
          coalesce(v_name, 'Um amigo') || ' pediu-te ' || p_amount || ' tós', '/friends',
          jsonb_build_object('from', v_uid, 'amount', p_amount));
end; $$;
revoke all on function public.request_tos(uuid, bigint) from public;
grant execute on function public.request_tos(uuid, bigint) to authenticated;

create or replace function public.duel_record(p_other uuid)
  returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'wins',   count(*) filter (where winner = auth.uid()),
    'losses', count(*) filter (where winner = p_other),
    'total',  count(*)
  )
  from public.duels
  where status = 'settled'
    and ((challenger = auth.uid() and opponent = p_other)
      or (challenger = p_other and opponent = auth.uid()));
$$;
revoke all on function public.duel_record(uuid) from public;
grant execute on function public.duel_record(uuid) to authenticated;
