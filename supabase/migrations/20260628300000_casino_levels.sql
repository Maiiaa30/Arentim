-- ============================================================================
-- Arentim — Casino XP / LEVELS. Progression derived from lifetime total_wagered
-- (1 Tostão wagered = 1 XP). The level curve is computed client-side for the
-- badge/progress bar; this migration mirrors it server-side and pays a small
-- one-time reward for each newly-reached level (claimed authoritatively).
--
-- Curve (keep in sync with src/features/profile/level.ts):
--   step(k)        = XP from level k to k+1 = 1500 + (k-1)*750   (arithmetic)
--   threshold(L)   = cumulative XP to BE level L = 1500*(L-1) + 375*(L-1)*(L-2)
--   reward(L)      = tós for reaching level L (L>=2) = 100 + (L-1)*20
-- Idempotent.
-- ============================================================================

alter table public.profiles add column if not exists levels_claimed int not null default 0;

create or replace function public.casino_level_threshold(p_level int)
  returns bigint language sql immutable as $$
  select case when p_level <= 1 then 0::bigint
    else 1500::bigint * (p_level - 1) + 375::bigint * (p_level - 1) * (p_level - 2) end;
$$;

create or replace function public.casino_level(p_wagered bigint)
  returns int language plpgsql immutable as $$
declare v_l int := 1;
begin
  while v_l < 200 and public.casino_level_threshold(v_l + 1) <= p_wagered loop
    v_l := v_l + 1;
  end loop;
  return v_l;
end; $$;

-- Pay the reward for every level reached since the last claim (one-time each).
create or replace function public.claim_level_rewards()
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles;
  v_level int;
  v_reward bigint := 0;
  v_l int;
  v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_p from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;

  v_level := public.casino_level(v_p.total_wagered);
  if v_level <= v_p.levels_claimed then
    return jsonb_build_object('status', 'none', 'level', v_level);
  end if;

  for v_l in (v_p.levels_claimed + 1) .. v_level loop
    v_reward := v_reward + (100 + (v_l - 1) * 20);
  end loop;

  v_after := v_p.balance + v_reward;
  if v_after > 1000000000000 then v_after := 1000000000000; end if;
  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (v_uid, 'bonus', v_after - v_p.balance, v_after, format('Recompensa de nível %s', v_level));
  update public.profiles set balance = v_after, levels_claimed = v_level where id = v_uid;

  return jsonb_build_object('status', 'claimed', 'reward', v_reward, 'level', v_level,
                            'from', v_p.levels_claimed + 1, 'to', v_level, 'balance', v_after);
end; $$;
revoke all on function public.claim_level_rewards() from public;
grant execute on function public.claim_level_rewards() to authenticated;
