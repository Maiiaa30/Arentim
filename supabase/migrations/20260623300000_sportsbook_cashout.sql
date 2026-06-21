-- ============================================================================
-- Arentim — sportsbook early cash-out ("vender aposta").
--
-- Sell a still-pending bet back BEFORE any of its fixtures kick off, for 90% of
-- the stake (10% house fee). Voids the bet + its legs and refunds. Disallowed
-- once any fixture has started (no in-play cash-out — keeps it house-safe and
-- simple). No money is created: refund < stake, and the lifetime "lost" added at
-- placement is reduced by the refunded amount so net P&L stays correct.
-- ============================================================================

create or replace function public.cashout_bet(p_bet_id bigint)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_bet public.bets;
  v_refund bigint; v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_bet from public.bets where id = p_bet_id and user_id = v_uid for update;
  if not found then raise exception 'aposta não encontrada' using errcode = 'check_violation'; end if;
  if v_bet.status <> 'pending' then raise exception 'aposta já liquidada' using errcode = 'check_violation'; end if;

  -- Every leg's fixture must still be in the future (nothing has started).
  if exists (
    select 1 from public.bet_selections bs
    join public.fixtures f on f.id = bs.fixture_id
    where bs.bet_id = p_bet_id and (f.status <> 'scheduled' or f.kickoff <= now())
  ) then
    raise exception 'só podes vender antes do início dos jogos' using errcode = 'check_violation';
  end if;

  v_refund := floor(v_bet.stake * 0.9);

  update public.bets set status = 'void', settled_at = now() where id = v_bet.id;
  update public.bet_selections set result = 'void' where bet_id = v_bet.id;

  select balance into v_balance from public.profiles where id = v_uid for update;
  v_after := v_balance + v_refund;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'refund', 'sportsbook', v_refund, v_after, 'venda de aposta (90%)');
  update public.profiles
     set balance = v_after, total_lost = greatest(0, total_lost - v_refund)
   where id = v_uid;

  return jsonb_build_object('refund', v_refund, 'balance', v_after);
end; $$;
revoke all on function public.cashout_bet(bigint) from public;
grant execute on function public.cashout_bet(bigint) to authenticated;
