-- ============================================================================
-- Arentim — DAILY SPIN wheel. One free spin per day for a Tostões reward,
-- separate from the play-gated streak bonus. Server-authoritative weighted
-- CSPRNG draw under a row lock (no replay / no multi-claim), once per calendar
-- day (UTC, like the rescue/daily-challenge resets). The wheel face is rendered
-- from spin_wheel_segments(); the actual prize is drawn server-side.
-- Idempotent.
-- ============================================================================

alter table public.profiles add column if not exists last_spin_date date;

-- The wheel face (index → amount), shared by the client renderer. The WEIGHTS
-- live only in daily_spin() below; keep the amounts here in sync with it.
create or replace function public.spin_wheel_segments()
  returns table (idx int, amount bigint)
  language sql immutable as $$
  select * from (values
    (0, 50::bigint), (1, 100::bigint), (2, 150::bigint), (3, 200::bigint),
    (4, 300::bigint), (5, 500::bigint), (6, 1000::bigint), (7, 2500::bigint)
  ) v(idx, amount);
$$;
revoke all on function public.spin_wheel_segments() from public;
grant execute on function public.spin_wheel_segments() to authenticated;

-- Whether the current user can spin today + when it resets.
create or replace function public.daily_spin_status()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_last date;
begin
  if auth.uid() is null then
    return jsonb_build_object('available', false, 'resets_at', (date_trunc('day', now()) + interval '1 day'));
  end if;
  select last_spin_date into v_last from public.profiles where id = auth.uid();
  return jsonb_build_object(
    'available', (v_last is distinct from current_date),
    'resets_at', (date_trunc('day', now()) + interval '1 day')
  );
end; $$;
revoke all on function public.daily_spin_status() from public;
grant execute on function public.daily_spin_status() to authenticated;

-- Perform the daily spin: weighted draw (weights sum to 100), credit, lock once/day.
create or replace function public.daily_spin()
  returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles;
  v_roll int;
  v_acc int := 0;
  v_idx int;
  v_amount bigint;
  v_after bigint;
  r record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  select * into v_p from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;

  if v_p.last_spin_date = current_date then
    return jsonb_build_object('status', 'already_spun',
                              'resets_at', (date_trunc('day', now()) + interval '1 day'));
  end if;

  v_roll := floor(public.csprng_unit() * 100)::int;   -- 0..99
  for r in (select * from (values
      (0, 50::bigint, 28), (1, 100::bigint, 24), (2, 150::bigint, 18), (3, 200::bigint, 12),
      (4, 300::bigint, 9),  (5, 500::bigint, 5),  (6, 1000::bigint, 3), (7, 2500::bigint, 1)
    ) t(idx, amount, weight) order by idx)
  loop
    v_acc := v_acc + r.weight;
    if v_roll < v_acc then v_idx := r.idx; v_amount := r.amount; exit; end if;
  end loop;
  if v_idx is null then v_idx := 0; v_amount := 50; end if;   -- safety net

  v_after := v_p.balance + v_amount;
  if v_after > 1000000000000 then raise exception 'balance overflow' using errcode = 'check_violation'; end if;

  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (v_uid, 'bonus', v_amount, v_after, format('Roleta diária · %s tós', v_amount));
  update public.profiles set balance = v_after, last_spin_date = current_date where id = v_uid;

  return jsonb_build_object('status', 'spun', 'index', v_idx, 'amount', v_amount,
                            'balance', v_after,
                            'resets_at', (date_trunc('day', now()) + interval '1 day'));
end; $$;
revoke all on function public.daily_spin() from public;
grant execute on function public.daily_spin() to authenticated;
