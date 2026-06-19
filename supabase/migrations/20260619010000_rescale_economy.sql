-- ============================================================================
-- Arentim — rescale the economy to smaller, "real-money-feeling" numbers.
--
-- New accounts start at 500 (was 5000); daily bonus, rescue grant and the
-- challenge catalog are scaled down accordingly. Existing balances are left
-- untouched — only new sign-ups and future rewards use the new scale.
-- ============================================================================

-- New-account starting balance.
alter table public.profiles alter column balance set default 500;

create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_starting bigint := 500;
begin
  v_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  if v_name is null then
    v_name := 'Jogador_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  insert into public.profiles (id, display_name, balance)
  values (new.id, v_name, v_starting);
  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (new.id, 'bonus', v_starting, v_starting, 'Bónus de boas-vindas');
  return new;
exception
  when unique_violation then
    v_name := substr(v_name, 1, 18) || '_' || substr(replace(new.id::text, '-', ''), 1, 5);
    insert into public.profiles (id, display_name, balance)
    values (new.id, v_name, v_starting);
    insert into public.transactions (user_id, type, amount, balance_after, note)
    values (new.id, 'bonus', v_starting, v_starting, 'Bónus de boas-vindas');
    return new;
end; $$;

-- Daily bonus: 10 / 15 / 25 / 35 / 50 / 70 / 100 (capped at day 7).
create or replace function public.daily_bonus_reward(p_day integer)
  returns bigint language sql immutable as $$
  select (case least(greatest(p_day, 1), 7)
    when 1 then 10
    when 2 then 15
    when 3 then 25
    when 4 then 35
    when 5 then 50
    when 6 then 70
    else 100
  end)::bigint;
$$;

-- Rescue grant: smaller threshold + amount.
create or replace function public.claim_rescue()
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v public.profiles;
  v_threshold bigint := 10;
  v_amount bigint := 30;
  v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;

  if v.balance >= v_threshold then
    return jsonb_build_object('status', 'not_eligible', 'balance', v.balance);
  end if;
  if v.last_rescue_date = current_date then
    return jsonb_build_object('status', 'already_claimed', 'balance', v.balance);
  end if;

  v_after := v.balance + v_amount;
  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (v_uid, 'bonus', v_amount, v_after, 'Resgate');
  update public.profiles set balance = v_after, last_rescue_date = current_date where id = v_uid;
  return jsonb_build_object('status', 'granted', 'amount', v_amount, 'balance', v_after);
end; $$;

-- Rescale the challenge catalog (targets + rewards) to the new economy.
update public.challenge_catalog set target = 5,    reward = 10  where key = 'rebuild_play5';
update public.challenge_catalog set target = 3,    reward = 15  where key = 'rebuild_win3';
update public.challenge_catalog set target = 500,  reward = 50,  description = 'Apostar 500 Tostões no total' where key = 'wager_5k';
update public.challenge_catalog set target = 5000, reward = 300, description = 'Apostar 5 000 Tostões no total' where key = 'wager_50k';
update public.challenge_catalog set target = 5,    reward = 80  where key = 'streak_5';
update public.challenge_catalog set target = 500,  reward = 100, description = 'Ganhar 500 Tostões num só lance' where key = 'bigwin_5k';
update public.challenge_catalog set reward = 150 where key = 'parlay_3leg';
update public.challenge_catalog set target = 25,   reward = 120 where key = 'win_25';
