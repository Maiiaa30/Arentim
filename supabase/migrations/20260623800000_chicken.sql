-- ============================================================================
-- Arentim — Frango na Estrada (chicken crossing). Step across lanes; each lane
-- survived grows the multiplier, but a car may hit you. Cash out before you're
-- squashed. Server draws a HIDDEN number of survivable lanes at start (geometric
-- with per-lane survival s set by difficulty); the round table has NO client
-- SELECT policy. Multiplier after k lanes = 0.97·(1/s)^k (≈ 3% edge, realised on
-- the first step; advancing is otherwise fair). Max 20 lanes.
-- ============================================================================

create table if not exists public.chicken_rounds (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  stake      bigint not null check (stake > 0),
  surv       numeric not null,   -- per-lane survival probability (hidden edge driver)
  safe_lanes int not null,       -- HIDDEN: lanes survivable before a hit
  step       int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.chicken_rounds enable row level security;  -- no select policy

create or replace function public.chicken_mult(p_step int, p_s numeric)
  returns numeric language sql immutable as $$
  select case when p_step <= 0 then 1.0
              else floor(0.97 * power(1.0 / p_s, p_step) * 100) / 100.0 end;
$$;

-- ---- chicken_start ----------------------------------------------------------
create or replace function public.chicken_start(p_stake bigint, p_difficulty text default 'easy')
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_s numeric; v_safe int := 0; v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;
  v_s := case p_difficulty when 'hard' then 0.45 when 'medium' then 0.65 else 0.82 end;

  delete from public.chicken_rounds where user_id = v_uid;  -- abandon = loss

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;
  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'chicken', -p_stake, v_after, 'frango');
  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;

  -- Geometric: keep surviving while the coin lands under s (capped at 20 lanes).
  while v_safe < 20 and public.csprng_unit() < v_s loop
    v_safe := v_safe + 1;
  end loop;

  insert into public.chicken_rounds (user_id, stake, surv, safe_lanes) values (v_uid, p_stake, v_s, v_safe);

  return jsonb_build_object('difficulty', p_difficulty, 'step', 0, 'multiplier', 1.0,
    'next_multiplier', public.chicken_mult(1, v_s), 'balance', v_after);
end; $$;
revoke all on function public.chicken_start(bigint, text) from public;
grant execute on function public.chicken_start(bigint, text) to authenticated;

-- ---- chicken_step -----------------------------------------------------------
create or replace function public.chicken_step()
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.chicken_rounds; v_next int; v_mult numeric; v_payout bigint; v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_r from public.chicken_rounds where user_id = v_uid for update;
  if not found then raise exception 'no round' using errcode = 'check_violation'; end if;
  v_next := v_r.step + 1;

  if v_next > v_r.safe_lanes then
    -- Hit by a car.
    delete from public.chicken_rounds where user_id = v_uid;
    insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
    values (v_uid, 'chicken', v_r.stake, 0, jsonb_build_object('hit_lane', v_next),
            jsonb_build_object('lanes', v_r.step));
    return jsonb_build_object('alive', false, 'lane', v_next, 'payout', 0);
  end if;

  v_mult := public.chicken_mult(v_next, v_r.surv);
  if v_next >= 20 then
    -- Cleared the road → auto cash-out.
    v_payout := floor(v_r.stake * v_mult);
    delete from public.chicken_rounds where user_id = v_uid;
    select balance into v_balance from public.profiles where id = v_uid for update;
    v_after := v_balance + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'chicken', v_payout, v_after, format('frango %sx', v_mult));
    update public.profiles set balance = v_after, total_won = total_won + v_payout,
           games_won = games_won + 1, biggest_win = greatest(biggest_win, v_payout) where id = v_uid;
    insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
    values (v_uid, 'chicken', v_r.stake, v_payout, jsonb_build_object('cleared', true), jsonb_build_object('multiplier', v_mult));
    return jsonb_build_object('alive', true, 'lane', v_next, 'multiplier', v_mult, 'cashed', true, 'payout', v_payout, 'balance', v_after);
  end if;

  update public.chicken_rounds set step = v_next where user_id = v_uid;
  return jsonb_build_object('alive', true, 'lane', v_next, 'multiplier', v_mult,
    'next_multiplier', public.chicken_mult(v_next + 1, v_r.surv), 'cashed', false);
end; $$;
revoke all on function public.chicken_step() from public;
grant execute on function public.chicken_step() to authenticated;

-- ---- chicken_cashout --------------------------------------------------------
create or replace function public.chicken_cashout()
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.chicken_rounds; v_mult numeric; v_payout bigint; v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_r from public.chicken_rounds where user_id = v_uid for update;
  if not found then raise exception 'no round' using errcode = 'check_violation'; end if;
  if v_r.step = 0 then raise exception 'atravessa pelo menos uma faixa' using errcode = 'check_violation'; end if;

  v_mult := public.chicken_mult(v_r.step, v_r.surv);
  v_payout := floor(v_r.stake * v_mult);
  delete from public.chicken_rounds where user_id = v_uid;
  select balance into v_balance from public.profiles where id = v_uid for update;
  v_after := v_balance + v_payout;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'win', 'chicken', v_payout, v_after, format('frango %sx', v_mult));
  update public.profiles set balance = v_after, total_won = total_won + v_payout,
         games_won = games_won + 1, biggest_win = greatest(biggest_win, v_payout) where id = v_uid;
  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
  values (v_uid, 'chicken', v_r.stake, v_payout, jsonb_build_object('cashed', true), jsonb_build_object('multiplier', v_mult, 'lanes', v_r.step));
  return jsonb_build_object('payout', v_payout, 'multiplier', v_mult, 'lane', v_r.step, 'balance', v_after);
end; $$;
revoke all on function public.chicken_cashout() from public;
grant execute on function public.chicken_cashout() to authenticated;
