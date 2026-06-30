-- ============================================================================
-- Arentim — Phase 11: challenges (recovery + high-roller).
--
-- Challenge progress is DERIVED server-side from existing aggregates/bets (no
-- client-trusted counters). A reward can be claimed once per challenge; claim
-- re-checks eligibility server-side before paying out. A daily "rescue" grant
-- guarantees a player with an empty balance is never stuck.
-- ============================================================================

alter table public.profiles add column if not exists last_rescue_date date;

-- Catalog of challenges (admin-tunable in Phase 12).
create table if not exists public.challenge_catalog (
  key         text primary key,
  title       text not null,
  description text not null,
  metric      text not null check (metric in ('total_wagered','games_won','games_played','streak','biggest_win','parlay3')),
  target      bigint not null check (target > 0),
  reward      bigint not null check (reward > 0),
  track       text not null check (track in ('recovery','highroller')),
  sort        int not null default 0,
  active      boolean not null default true
);

create table if not exists public.challenge_claims (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  challenge_key text not null references public.challenge_catalog (key) on delete cascade,
  claimed_at    timestamptz not null default now(),
  primary key (user_id, challenge_key)
);

alter table public.challenge_catalog enable row level security;
alter table public.challenge_claims enable row level security;

drop policy if exists challenge_catalog_read on public.challenge_catalog;
create policy challenge_catalog_read on public.challenge_catalog
  for select to authenticated using (active or public.is_admin());

drop policy if exists challenge_claims_select_own on public.challenge_claims;
create policy challenge_claims_select_own on public.challenge_claims
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Derive a metric's current value for a user (server-side, trusted).
create or replace function public.challenge_progress(p_uid uuid, p_metric text)
  returns bigint language plpgsql stable security definer set search_path = public as $$
declare v public.profiles;
begin
  select * into v from public.profiles where id = p_uid;
  if not found then return 0; end if;
  return case p_metric
    when 'total_wagered' then v.total_wagered
    when 'games_won' then v.games_won::bigint
    when 'games_played' then v.games_played::bigint
    when 'streak' then v.streak_count::bigint
    when 'biggest_win' then v.biggest_win
    when 'parlay3' then (
      select count(*) from public.bets b
       where b.user_id = p_uid and b.status = 'won'
         and (select count(*) from public.bet_selections s where s.bet_id = b.id) >= 3
    )
    else 0 end;
end; $$;
revoke all on function public.challenge_progress(uuid, text) from public;

create or replace function public.list_challenges()
  returns table (
    key text, title text, description text, track text, target bigint,
    reward bigint, progress bigint, claimed boolean
  )
  language sql stable security definer set search_path = public as $$
  select c.key, c.title, c.description, c.track, c.target, c.reward,
         least(public.challenge_progress(auth.uid(), c.metric), c.target) as progress,
         exists (select 1 from public.challenge_claims cc
                  where cc.user_id = auth.uid() and cc.challenge_key = c.key) as claimed
    from public.challenge_catalog c
   where c.active
   order by c.track, c.sort, c.key;
$$;
revoke all on function public.list_challenges() from public;
grant execute on function public.list_challenges() to authenticated;

create or replace function public.claim_challenge(p_key text)
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.challenge_catalog;
  v_progress bigint;
  v_after bigint;
  v_balance bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into c from public.challenge_catalog where key = p_key and active;
  if not found then raise exception 'unknown challenge' using errcode = 'check_violation'; end if;

  if exists (select 1 from public.challenge_claims where user_id = v_uid and challenge_key = p_key) then
    return jsonb_build_object('status', 'already_claimed');
  end if;

  v_progress := public.challenge_progress(v_uid, c.metric);
  if v_progress < c.target then
    return jsonb_build_object('status', 'incomplete', 'progress', v_progress, 'target', c.target);
  end if;

  -- Record the claim first (unique PK prevents a double-claim race), then pay.
  insert into public.challenge_claims (user_id, challenge_key) values (v_uid, p_key);

  select balance into v_balance from public.profiles where id = v_uid for update;
  v_after := v_balance + c.reward;
  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (v_uid, 'bonus', c.reward, v_after, format('Challenge: %s', c.title));
  update public.profiles set balance = v_after where id = v_uid;

  return jsonb_build_object('status', 'claimed', 'reward', c.reward, 'balance', v_after);
end; $$;
revoke all on function public.claim_challenge(text) from public;
grant execute on function public.claim_challenge(text) to authenticated;

-- Daily rescue: a free grant when the balance is at rock bottom (anti-stuck).
create or replace function public.claim_rescue()
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v public.profiles;
  v_threshold bigint := 100;
  v_amount bigint := 300;
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
  values (v_uid, 'bonus', v_amount, v_after, 'Rescue grant');
  update public.profiles set balance = v_after, last_rescue_date = current_date where id = v_uid;
  return jsonb_build_object('status', 'granted', 'amount', v_amount, 'balance', v_after);
end; $$;
revoke all on function public.claim_rescue() from public;
grant execute on function public.claim_rescue() to authenticated;

-- ---- Seed the catalog ------------------------------------------------------
insert into public.challenge_catalog (key, title, description, metric, target, reward, track, sort) values
  ('rebuild_play5', 'Back in the game', 'Play 5 rounds', 'games_played', 5, 100, 'recovery', 1),
  ('rebuild_win3', 'Find your feet', 'Win 3 rounds', 'games_won', 3, 150, 'recovery', 2),
  ('wager_5k', 'Getting serious', 'Wager 5.000 Tostões in total', 'total_wagered', 5000, 500, 'highroller', 1),
  ('wager_50k', 'High roller', 'Wager 50.000 Tostões in total', 'total_wagered', 50000, 3000, 'highroller', 2),
  ('streak_5', 'On a roll', 'Reach a 5-day streak', 'streak', 5, 800, 'highroller', 3),
  ('bigwin_5k', 'Big hit', 'Win 5.000 Tostões in a single payout', 'biggest_win', 5000, 1000, 'highroller', 4),
  ('parlay_3leg', 'Accumulator ace', 'Land a winning 3-leg parlay', 'parlay3', 1, 1500, 'highroller', 5),
  ('win_25', 'Seasoned', 'Win 25 rounds', 'games_won', 25, 1200, 'highroller', 6)
on conflict (key) do nothing;
