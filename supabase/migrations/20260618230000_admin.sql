-- ============================================================================
-- Arentim — Phase 12: admin panel (role-gated + fully audited).
--
-- Every admin mutation is a SECURITY DEFINER function that re-checks is_admin()
-- server-side (never trusting the UI) and writes an admin_actions audit row.
-- Suspensions are enforced in the database via a trigger on transactions, so a
-- suspended user cannot move money through ANY path (casino, poker, bonus) —
-- only admin 'adjustment' entries are allowed through.
-- ============================================================================

alter table public.profiles add column if not exists suspended boolean not null default false;

-- ---- Audit log -------------------------------------------------------------
create table if not exists public.admin_actions (
  id             bigint generated always as identity primary key,
  admin_id       uuid not null references public.profiles (id),
  target_user_id uuid references public.profiles (id),
  action         text not null,
  detail         jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;
drop policy if exists admin_actions_admin_select on public.admin_actions;
create policy admin_actions_admin_select on public.admin_actions
  for select to authenticated using (public.is_admin());

-- ---- Announcements (broadcast) ---------------------------------------------
create table if not exists public.announcements (
  id         bigint generated always as identity primary key,
  admin_id   uuid not null references public.profiles (id),
  title      text not null,
  body       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements
  for select to authenticated using (active or public.is_admin());

-- Publish announcements over Realtime so banners appear instantly.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements') then
    alter publication supabase_realtime add table public.announcements;
  end if;
end $$;

-- ---- Suspension enforcement ------------------------------------------------
create or replace function public.enforce_not_suspended()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type <> 'adjustment'
     and exists (select 1 from public.profiles p where p.id = new.user_id and p.suspended) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  return new;
end; $$;

drop trigger if exists trg_enforce_not_suspended on public.transactions;
create trigger trg_enforce_not_suspended
  before insert on public.transactions
  for each row execute function public.enforce_not_suspended();

-- ---- Audit helper ----------------------------------------------------------
create or replace function public.admin_audit(p_target uuid, p_action text, p_detail jsonb)
  returns void language sql security definer set search_path = public as $$
  insert into public.admin_actions (admin_id, target_user_id, action, detail)
  values (auth.uid(), p_target, p_action, p_detail);
$$;
revoke all on function public.admin_audit(uuid, text, jsonb) from public;

-- ---- Admin mutations -------------------------------------------------------
create or replace function public.admin_adjust_balance(p_user uuid, p_amount bigint, p_reason text)
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_balance bigint; v_after bigint;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = 'check_violation';
  end if;
  select balance into v_balance from public.profiles where id = p_user for update;
  if not found then raise exception 'user not found'; end if;
  v_after := v_balance + p_amount;
  if v_after < 0 then raise exception 'adjustment would make balance negative' using errcode = 'check_violation'; end if;

  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (p_user, 'adjustment', p_amount, v_after, p_reason);
  update public.profiles set balance = v_after where id = p_user;
  perform public.admin_audit(p_user, 'adjust_balance', jsonb_build_object('amount', p_amount, 'reason', p_reason));
  return jsonb_build_object('balance', v_after);
end; $$;
revoke all on function public.admin_adjust_balance(uuid, bigint, text) from public;
grant execute on function public.admin_adjust_balance(uuid, bigint, text) to authenticated;

create or replace function public.admin_set_streak(p_user uuid, p_streak int, p_reason text)
  returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_streak < 0 then raise exception 'invalid streak' using errcode = 'check_violation'; end if;
  update public.profiles set streak_count = p_streak where id = p_user;
  perform public.admin_audit(p_user, 'set_streak', jsonb_build_object('streak', p_streak, 'reason', p_reason));
end; $$;
revoke all on function public.admin_set_streak(uuid, int, text) from public;
grant execute on function public.admin_set_streak(uuid, int, text) to authenticated;

create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_reason text)
  returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.profiles set suspended = p_suspended where id = p_user;
  perform public.admin_audit(p_user, case when p_suspended then 'suspend' else 'unsuspend' end,
                             jsonb_build_object('reason', p_reason));
end; $$;
revoke all on function public.admin_set_suspended(uuid, boolean, text) from public;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_odds(p_fixture bigint, p_odds jsonb)
  returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.fixtures set odds = p_odds, updated_at = now() where id = p_fixture;
  perform public.admin_audit(null, 'set_odds', jsonb_build_object('fixture', p_fixture, 'odds', p_odds));
end; $$;
revoke all on function public.admin_set_odds(bigint, jsonb) from public;
grant execute on function public.admin_set_odds(bigint, jsonb) to authenticated;

-- Re-create with audit (was added in the sportsbook migration).
create or replace function public.admin_settle_fixture(p_fixture_id bigint, p_home int, p_away int)
  returns void language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.fixtures
     set home_score = p_home, away_score = p_away, status = 'finished', updated_at = now()
   where id = p_fixture_id;
  perform public.settle_fixture(p_fixture_id);
  perform public.admin_audit(null, 'settle_fixture',
    jsonb_build_object('fixture', p_fixture_id, 'score', format('%s-%s', p_home, p_away)));
end; $$;

create or replace function public.admin_upsert_challenge(
  p_key text, p_title text, p_description text, p_metric text,
  p_target bigint, p_reward bigint, p_track text, p_active boolean
)
  returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.challenge_catalog (key, title, description, metric, target, reward, track, active)
  values (p_key, p_title, p_description, p_metric, p_target, p_reward, p_track, p_active)
  on conflict (key) do update set
    title = excluded.title, description = excluded.description, metric = excluded.metric,
    target = excluded.target, reward = excluded.reward, track = excluded.track, active = excluded.active;
  perform public.admin_audit(null, 'upsert_challenge', jsonb_build_object('key', p_key, 'reward', p_reward));
end; $$;
revoke all on function public.admin_upsert_challenge(text, text, text, text, bigint, bigint, text, boolean) from public;
grant execute on function public.admin_upsert_challenge(text, text, text, text, bigint, bigint, text, boolean) to authenticated;

create or replace function public.admin_broadcast(p_title text, p_body text)
  returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(trim(coalesce(p_title, ''))) = 0 then raise exception 'title required' using errcode = 'check_violation'; end if;
  insert into public.announcements (admin_id, title, body) values (auth.uid(), p_title, p_body);
  perform public.admin_audit(null, 'broadcast', jsonb_build_object('title', p_title));
end; $$;
revoke all on function public.admin_broadcast(text, text) from public;
grant execute on function public.admin_broadcast(text, text) to authenticated;
