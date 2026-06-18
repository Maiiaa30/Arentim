-- ============================================================================
-- Arentim — Phase 4: daily play-gated streak bonus.
--
-- A day counts toward the streak only if the player has played a qualifying
-- round that day (last_played_date = today, set by the game RPCs). The bonus is
-- claimable once per day; claiming on consecutive days grows the streak, a gap
-- resets it. All eligibility + crediting happens server-side under a row lock,
-- so the bonus cannot be replayed or multi-claimed (A06).
-- ============================================================================

-- Escalating reward by streak day (capped at day 7).
create or replace function public.daily_bonus_reward(p_day integer)
  returns bigint
  language sql
  immutable
as $$
  select (case least(greatest(p_day, 1), 7)
    when 1 then 100
    when 2 then 150
    when 3 then 225
    when 4 then 325
    when 5 then 450
    when 6 then 600
    else 800
  end)::bigint;
$$;

create or replace function public.claim_daily_bonus()
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_p          public.profiles;
  v_today      date := current_date;
  v_new_streak integer;
  v_reward     bigint;
  v_after      bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Lock the row so concurrent claims can't both pass the eligibility check.
  select * into v_p from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'profile not found';
  end if;

  -- Already claimed today → no multi-claim / no replay.
  if v_p.last_claim_date = v_today then
    return jsonb_build_object(
      'status', 'already_claimed', 'streak', v_p.streak_count,
      'reward', 0, 'balance', v_p.balance
    );
  end if;

  -- Must have played a qualifying round today to unlock the bonus.
  if v_p.last_played_date is distinct from v_today then
    return jsonb_build_object(
      'status', 'play_required', 'streak', v_p.streak_count,
      'reward', 0, 'balance', v_p.balance
    );
  end if;

  -- Consecutive day continues the streak; any gap (or first ever) resets to 1.
  if v_p.last_claim_date = v_today - 1 then
    v_new_streak := v_p.streak_count + 1;
  else
    v_new_streak := 1;
  end if;

  v_reward := public.daily_bonus_reward(v_new_streak);
  v_after := v_p.balance + v_reward;
  if v_after > 1000000000000 then
    raise exception 'balance overflow' using errcode = 'check_violation';
  end if;

  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (v_uid, 'bonus', v_reward, v_after,
          format('Daily bonus · day %s', least(v_new_streak, 7)));

  update public.profiles
     set balance        = v_after,
         streak_count    = v_new_streak,
         last_claim_date = v_today
   where id = v_uid;

  return jsonb_build_object(
    'status', 'claimed', 'streak', v_new_streak,
    'reward', v_reward, 'balance', v_after
  );
end;
$$;

revoke all on function public.claim_daily_bonus() from public;
grant execute on function public.claim_daily_bonus() to authenticated;
