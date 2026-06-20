-- ============================================================================
-- Arentim — interactive Crash. Unlike the old one-shot target model, the player
-- now cashes out manually while a rocket climbs. The server draws a hidden crash
-- point at launch (0.96/(1-u), ~4% edge); the live multiplier is purely a
-- function of elapsed server time: m(t) = e^(0.20·t). You win stake×m if you
-- cash out before m reaches the crash point, else you bust.
--
-- Three RPCs: crash_start (debit + draw), crash_state (read-only live multiplier
-- for polling/animation) and crash_cashout (authoritative settle). crash_history
-- exposes recent crash points for the "previous crashes" strip.
-- ============================================================================

drop function if exists public.play_crash(bigint, double precision, text);

create table if not exists public.crash_rounds (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  stake       bigint not null check (stake > 0),
  crash_point numeric not null,
  auto_target numeric,
  started_at  timestamptz not null default now(),
  settled     boolean not null default false,
  cashout     numeric,
  payout      bigint not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists crash_rounds_user_idx on public.crash_rounds (user_id, id desc);
create index if not exists crash_rounds_recent_idx on public.crash_rounds (id desc) where settled;
alter table public.crash_rounds enable row level security;
drop policy if exists crash_rounds_select_own on public.crash_rounds;
create policy crash_rounds_select_own on public.crash_rounds
  for select to authenticated using (user_id = auth.uid());

-- Live multiplier for an elapsed-seconds value, truncated to 2dp, floored at 1.
create or replace function public.crash_mult(p_elapsed double precision)
  returns numeric language sql immutable as $$
  select greatest(1.0, floor(exp(0.20 * p_elapsed) * 100) / 100.0)::numeric;
$$;

-- ---- crash_start ------------------------------------------------------------
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

  -- Any unsettled round the player walked away from is a bust.
  update public.crash_rounds set settled = true, cashout = crash_point, payout = 0
   where user_id = v_uid and not settled;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'crash', -p_stake, v_after, 'crash');

  v_u := public.csprng_unit();
  v_crash := least(1000.0, 0.96 / (1.0 - v_u));
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

-- ---- crash_state (read-only) ------------------------------------------------
create or replace function public.crash_state(p_round_id bigint)
  returns jsonb language plpgsql stable security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.crash_rounds;
  v_m numeric;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_r from public.crash_rounds where id = p_round_id and user_id = v_uid;
  if not found then return jsonb_build_object('phase', 'none'); end if;
  if v_r.settled then
    return jsonb_build_object('phase', 'settled', 'won', v_r.payout > 0,
                              'mult', v_r.cashout, 'crash', v_r.crash_point, 'payout', v_r.payout);
  end if;
  v_m := public.crash_mult(extract(epoch from now() - v_r.started_at));
  if v_m >= v_r.crash_point then
    return jsonb_build_object('phase', 'busted', 'mult', v_r.crash_point, 'crash', v_r.crash_point);
  end if;
  return jsonb_build_object('phase', 'flying', 'mult', v_m);
end;
$$;
revoke all on function public.crash_state(bigint) from public;
grant execute on function public.crash_state(bigint) to authenticated;

-- ---- crash_cashout (authoritative settle) -----------------------------------
create or replace function public.crash_cashout(p_round_id bigint)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.crash_rounds;
  v_m numeric; v_cashout numeric; v_payout bigint := 0; v_win boolean;
  v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_r from public.crash_rounds where id = p_round_id and user_id = v_uid for update;
  if not found then raise exception 'no such round' using errcode = 'check_violation'; end if;

  if v_r.settled then
    return jsonb_build_object('won', v_r.payout > 0, 'mult', v_r.cashout, 'crash', v_r.crash_point,
                              'payout', v_r.payout, 'balance', (select balance from public.profiles where id = v_uid),
                              'replayed', true);
  end if;

  v_m := public.crash_mult(extract(epoch from now() - v_r.started_at));
  if v_m >= v_r.crash_point then
    v_win := false; v_cashout := v_r.crash_point; v_payout := 0;
  else
    v_win := true; v_cashout := v_m; v_payout := floor(v_r.stake * v_m);
  end if;

  update public.crash_rounds set settled = true, cashout = v_cashout, payout = v_payout where id = v_r.id;

  select balance into v_balance from public.profiles where id = v_uid for update;
  v_after := v_balance;
  if v_payout > 0 then
    v_after := v_balance + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'crash', v_payout, v_after, format('crash %sx', v_cashout));
    update public.profiles
       set balance = v_after, total_won = total_won + v_payout, games_won = games_won + 1,
           biggest_win = greatest(biggest_win, v_payout)
     where id = v_uid;
  end if;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
  values (v_uid, 'crash', v_r.stake, v_payout,
          jsonb_build_object('crash', v_r.crash_point, 'cashout', v_cashout, 'won', v_win),
          jsonb_build_object('multiplier', v_cashout));

  return jsonb_build_object('won', v_win, 'mult', v_cashout, 'crash', v_r.crash_point,
                            'payout', v_payout, 'balance', v_after, 'replayed', false);
end;
$$;
revoke all on function public.crash_cashout(bigint) from public;
grant execute on function public.crash_cashout(bigint) to authenticated;

-- ---- crash_history (recent crash points, any player) ------------------------
create or replace function public.crash_history()
  returns jsonb language sql stable security definer
  set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(crash_point order by id desc), '[]'::jsonb)
  from (select id, crash_point from public.crash_rounds where settled order by id desc limit 15) q;
$$;
revoke all on function public.crash_history() from public;
grant execute on function public.crash_history() to authenticated;
