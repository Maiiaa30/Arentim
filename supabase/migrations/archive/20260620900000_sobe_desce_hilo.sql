-- ============================================================================
-- Arentim — Sobe e Desce becomes a real higher/lower game.
--
-- Each round reveals a random current rung N (1..13). You bet the next number is
-- higher (Sobe) or lower (Desce). The payout adapts to the odds: on 8 there are
-- 5 numbers above and 7 below, so Sobe is less likely and pays more than Desce.
-- The next number is drawn from the 12 OTHER rungs (no ties). Fair multiplier =
-- 12 / winning-count, times 0.95 for a ~5% house edge.
--
-- hilo_deal() reveals N (+ the two adapted multipliers); hilo_bet() draws the
-- next number and settles. A one-row-per-user table holds the dealt number so a
-- player can't pick after seeing the next card.
-- ============================================================================

drop function if exists public.play_hilo(bigint, text, text);

create table if not exists public.hilo_rounds (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  current_n  int not null check (current_n between 1 and 13),
  created_at timestamptz not null default now()
);
alter table public.hilo_rounds enable row level security;
drop policy if exists hilo_rounds_select_own on public.hilo_rounds;
create policy hilo_rounds_select_own on public.hilo_rounds
  for select to authenticated using (user_id = auth.uid());

-- Adapted multiplier for a winning-count out of 12 (0.95 RTP), 2dp.
create or replace function public.hilo_mult(p_count int)
  returns numeric language sql immutable as $$
  select case when p_count > 0 then round(0.95 * 12.0 / p_count, 2) else 0 end;
$$;

-- ---- hilo_deal --------------------------------------------------------------
create or replace function public.hilo_deal()
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  v_n := public.csprng_below(13) + 1;
  insert into public.hilo_rounds (user_id, current_n) values (v_uid, v_n)
    on conflict (user_id) do update set current_n = excluded.current_n, created_at = now();
  return jsonb_build_object(
    'current', v_n,
    'sobe_count', 13 - v_n, 'desce_count', v_n - 1,
    'sobe_mult', public.hilo_mult(13 - v_n), 'desce_mult', public.hilo_mult(v_n - 1));
end;
$$;
revoke all on function public.hilo_deal() from public;
grant execute on function public.hilo_deal() to authenticated;

-- ---- hilo_bet ---------------------------------------------------------------
create or replace function public.hilo_bet(p_stake bigint, p_pick text)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_n int; v_m int; v_count int;
  v_mult numeric; v_payout bigint := 0; v_win boolean;
  v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_pick not in ('sobe', 'desce') then raise exception 'invalid pick' using errcode = 'check_violation'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  -- Claim the dealt number atomically (prevents double-spend / picking late).
  delete from public.hilo_rounds where user_id = v_uid returning current_n into v_n;
  if v_n is null then raise exception 'deal a number first' using errcode = 'check_violation'; end if;

  v_count := case when p_pick = 'sobe' then 13 - v_n else v_n - 1 end;
  if v_count = 0 then raise exception 'that side is impossible on this number' using errcode = 'check_violation'; end if;
  v_mult := public.hilo_mult(v_count);

  -- Next number from the 12 rungs other than N.
  v_m := public.csprng_below(12) + 1;
  if v_m >= v_n then v_m := v_m + 1; end if;

  v_win := (p_pick = 'sobe' and v_m > v_n) or (p_pick = 'desce' and v_m < v_n);

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'sobedesce', -p_stake, v_after, format('sobe e desce de %s', v_n));

  if v_win then
    v_payout := floor(p_stake * v_mult);
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'sobedesce', v_payout, v_after, format('%s->%s', v_n, v_m));
  end if;

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
         total_lost = total_lost + p_stake, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_win then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
  values (v_uid, 'sobedesce', p_stake, v_payout,
          jsonb_build_object('current', v_n, 'next', v_m, 'pick', p_pick),
          jsonb_build_object('multiplier', v_mult));

  return jsonb_build_object('current', v_n, 'next', v_m, 'won', v_win, 'mult', v_mult,
                            'payout', v_payout, 'balance', v_after);
end;
$$;
revoke all on function public.hilo_bet(bigint, text) from public;
grant execute on function public.hilo_bet(bigint, text) to authenticated;
