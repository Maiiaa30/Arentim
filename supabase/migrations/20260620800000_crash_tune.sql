-- ============================================================================
-- Arentim — tune Crash so it doesn't bust so early so often.
--
-- The crash point follows k/(1-u): the floor (smallest possible crash) equals k,
-- and the house edge is (1-k). At k=0.96 ~13% of rounds busted below 1.10×. To
-- raise the floor (and thin the very-early busts) without creating an exploit
-- (cashing out below the floor would be free money), k must rise to 1.0 — i.e. a
-- FAIR game. Now the floor is 1.00× and only ~9% bust below 1.10×, ~5% below
-- 1.05×. We also slow the climb (0.20 → 0.15) to give more reaction time.
-- ============================================================================

create or replace function public.crash_mult(p_elapsed double precision)
  returns numeric language sql immutable as $$
  select greatest(1.0, floor(exp(0.15 * p_elapsed) * 100) / 100.0)::numeric;
$$;

create or replace function public.crash_start(
  p_stake bigint,
  p_auto_target double precision default null
)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint; v_after bigint;
  v_u double precision; v_crash numeric; v_auto numeric := null;
  v_round bigint; v_started timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;
  if p_auto_target is not null then
    if p_auto_target < 1.01 or p_auto_target > 1000 then
      raise exception 'invalid target' using errcode = 'check_violation';
    end if;
    v_auto := round(p_auto_target::numeric, 2);
  end if;

  update public.crash_rounds set settled = true, cashout = crash_point, payout = 0
   where user_id = v_uid and not settled;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'crash', -p_stake, v_after, 'crash');

  -- Fair floor: k = 1.0, so the smallest possible crash is 1.00×.
  v_u := public.csprng_unit();
  v_crash := least(1000.0, 1.0 / (1.0 - v_u));
  if v_crash < 1.0 then v_crash := 1.0; end if;
  v_crash := floor(v_crash * 100) / 100.0;

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;

  insert into public.crash_rounds (user_id, stake, crash_point, auto_target)
  values (v_uid, p_stake, v_crash, v_auto)
  returning id, started_at into v_round, v_started;

  return jsonb_build_object('round_id', v_round, 'started_at', v_started, 'auto_target', v_auto, 'balance', v_after);
end;
$$;
revoke all on function public.crash_start(bigint, double precision) from public;
grant execute on function public.crash_start(bigint, double precision) to authenticated;
