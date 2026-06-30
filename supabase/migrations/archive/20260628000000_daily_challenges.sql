-- ============================================================================
-- Arentim — DAILY challenges (a fresh set for everyone, every day).
--
-- Unlike the lifetime `challenge_catalog` (claim-once, cumulative profile
-- aggregates), these reset at midnight. Each day a deterministic subset of a
-- shared pool is "active" — the SAME challenges for every player — and progress
-- is measured against TODAY's activity only, derived server-side from the
-- immutable `transactions` ledger (every game records a 'bet' stake row and
-- 'win' payout rows — see 20260618120000_init_auth_wallet). No client-trusted
-- counters; a claim re-checks eligibility before paying and can be done once
-- per challenge per day.
--
-- Also tops up the lifetime catalog with more milestone challenges.
-- Idempotent.
-- ============================================================================

-- ---- Daily catalog (a pool we rotate through) ------------------------------
create table if not exists public.daily_challenge_catalog (
  key         text primary key,
  title       text not null,
  description text not null,
  metric      text not null check (metric in (
                'daily_games','daily_wins','daily_wagered','daily_bigwin','daily_distinct_games')),
  target      bigint not null check (target > 0),
  reward      bigint not null check (reward > 0),
  sort        int not null default 0,
  active      boolean not null default true
);

-- ---- Per-day claim ledger (one row per user per challenge per day) ----------
create table if not exists public.daily_challenge_claims (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  challenge_key text not null references public.daily_challenge_catalog (key) on delete cascade,
  claim_date    date not null default current_date,
  claimed_at    timestamptz not null default now(),
  reward        bigint not null,
  primary key (user_id, challenge_key, claim_date)
);

create index if not exists daily_challenge_claims_user_date_idx
  on public.daily_challenge_claims (user_id, claim_date desc);

alter table public.daily_challenge_catalog enable row level security;
alter table public.daily_challenge_claims  enable row level security;

drop policy if exists daily_challenge_catalog_read on public.daily_challenge_catalog;
create policy daily_challenge_catalog_read on public.daily_challenge_catalog
  for select to authenticated using (active or public.is_admin());

drop policy if exists daily_challenge_claims_select_own on public.daily_challenge_claims;
create policy daily_challenge_claims_select_own on public.daily_challenge_claims
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---- Today's value of a daily metric (server-trusted, from the ledger) ------
create or replace function public.daily_metric_progress(p_uid uuid, p_metric text)
  returns bigint language plpgsql stable security definer set search_path = public as $$
declare v_start timestamptz := date_trunc('day', now());
begin
  if p_uid is null then return 0; end if;
  return case p_metric
    when 'daily_games' then (
      select count(*) from public.transactions t
       where t.user_id = p_uid and t.type = 'bet' and t.created_at >= v_start)
    when 'daily_wins' then (
      select count(*) from public.transactions t
       where t.user_id = p_uid and t.type = 'win' and t.amount > 0 and t.created_at >= v_start)
    when 'daily_wagered' then (
      select coalesce(sum(-t.amount), 0) from public.transactions t
       where t.user_id = p_uid and t.type = 'bet' and t.created_at >= v_start)
    when 'daily_bigwin' then (
      select coalesce(max(t.amount), 0) from public.transactions t
       where t.user_id = p_uid and t.type = 'win' and t.created_at >= v_start)
    when 'daily_distinct_games' then (
      select count(distinct t.game) from public.transactions t
       where t.user_id = p_uid and t.type = 'bet' and t.game is not null and t.created_at >= v_start)
    else 0 end;
end; $$;
revoke all on function public.daily_metric_progress(uuid, text) from public;

-- ---- The challenges active for a given day (same for everyone) --------------
-- Deterministic rotation: order the active pool, then pick a window of up to 3
-- starting at an offset derived from the date (Julian day) so the set changes
-- daily but is identical for every player. Wraps around the pool.
create or replace function public.daily_challenge_keys(p_date date)
  returns table (key text, slot int)
  language sql stable security definer set search_path = public as $$
  with pool as (
    select c.key, (row_number() over (order by c.sort, c.key))::int - 1 as idx
      from public.daily_challenge_catalog c
     where c.active
  ),
  n as (select count(*)::int as cnt from pool),
  picks as (
    select gs as slot,
           (to_char(p_date, 'J')::int + gs) % (select cnt from n) as idx
      from generate_series(0, least(3, (select cnt from n)) - 1) gs
     where (select cnt from n) > 0
  )
  select pool.key, picks.slot
    from picks join pool on pool.idx = picks.idx
   order by picks.slot;
$$;
revoke all on function public.daily_challenge_keys(date) from public;

-- ---- List today's daily challenges with progress + claimed flag -------------
create or replace function public.list_daily_challenges()
  returns table (
    key text, title text, description text, target bigint, reward bigint,
    progress bigint, claimed boolean, slot int, resets_at timestamptz
  )
  language sql stable security definer set search_path = public as $$
  select c.key, c.title, c.description, c.target, c.reward,
         least(public.daily_metric_progress(auth.uid(), c.metric), c.target) as progress,
         exists (select 1 from public.daily_challenge_claims dc
                  where dc.user_id = auth.uid()
                    and dc.challenge_key = c.key
                    and dc.claim_date = current_date) as claimed,
         k.slot,
         (date_trunc('day', now()) + interval '1 day') as resets_at
    from public.daily_challenge_keys(current_date) k
    join public.daily_challenge_catalog c on c.key = k.key
   order by k.slot;
$$;
revoke all on function public.list_daily_challenges() from public;
grant execute on function public.list_daily_challenges() to authenticated;

-- ---- Claim a daily challenge (re-checks eligibility, pays once per day) ------
create or replace function public.claim_daily_challenge(p_key text)
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.daily_challenge_catalog;
  v_progress bigint;
  v_balance bigint;
  v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  -- Must be one of TODAY's active daily challenges (can't claim an off-rotation one).
  if not exists (select 1 from public.daily_challenge_keys(current_date) k where k.key = p_key) then
    raise exception 'challenge not active today' using errcode = 'check_violation';
  end if;

  select * into c from public.daily_challenge_catalog where key = p_key and active;
  if not found then raise exception 'unknown challenge' using errcode = 'check_violation'; end if;

  if exists (select 1 from public.daily_challenge_claims
              where user_id = v_uid and challenge_key = p_key and claim_date = current_date) then
    return jsonb_build_object('status', 'already_claimed');
  end if;

  v_progress := public.daily_metric_progress(v_uid, c.metric);
  if v_progress < c.target then
    return jsonb_build_object('status', 'incomplete', 'progress', v_progress, 'target', c.target);
  end if;

  -- Record the claim first (PK prevents a double-claim race), then pay.
  insert into public.daily_challenge_claims (user_id, challenge_key, claim_date, reward)
  values (v_uid, p_key, current_date, c.reward);

  select balance into v_balance from public.profiles where id = v_uid for update;
  v_after := v_balance + c.reward;
  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (v_uid, 'bonus', c.reward, v_after, format('Desafio diário: %s', c.title));
  update public.profiles set balance = v_after where id = v_uid;

  return jsonb_build_object('status', 'claimed', 'reward', c.reward, 'balance', v_after);
end; $$;
revoke all on function public.claim_daily_challenge(text) from public;
grant execute on function public.claim_daily_challenge(text) to authenticated;

-- ---- Seed the daily pool (PT-PT) -------------------------------------------
insert into public.daily_challenge_catalog (key, title, description, metric, target, reward, sort) values
  ('d_play5',    'Aquecimento',   'Jogar 5 lances hoje',                       'daily_games',         5,    20, 1),
  ('d_play15',   'Maratona',      'Jogar 15 lances hoje',                      'daily_games',         15,   55, 2),
  ('d_win3',     'Pé quente',     'Ganhar 3 lances hoje',                      'daily_wins',          3,    30, 3),
  ('d_win8',     'Imparável',     'Ganhar 8 lances hoje',                      'daily_wins',          8,    75, 4),
  ('d_wager500', 'A postos',      'Apostar 500 Tostões hoje',                  'daily_wagered',       500,  30, 5),
  ('d_wager2k',  'Sem medo',      'Apostar 2 000 Tostões hoje',                'daily_wagered',       2000, 80, 6),
  ('d_bigwin300','Golpe do dia',  'Ganhar 300 Tostões num só lance hoje',      'daily_bigwin',        300,  60, 7),
  ('d_variety3', 'Variedade',     'Jogar 3 jogos diferentes hoje',             'daily_distinct_games',3,    45, 8),
  ('d_variety5', 'Explorador',    'Jogar 5 jogos diferentes hoje',             'daily_distinct_games',5,    80, 9)
on conflict (key) do nothing;

-- ---- More lifetime milestones (PT-PT) — "create more desafios" --------------
insert into public.challenge_catalog (key, title, description, metric, target, reward, track, sort) values
  ('games_200',  'Habitué',     'Jogar 200 lances',                  'games_played', 200,   600,  'highroller', 7),
  ('win_50',     'Mestre',      'Ganhar 50 lances',                  'games_won',    50,    400,  'highroller', 8),
  ('streak_10',  'Fiel',        'Atingir uma sequência de 10 dias',  'streak',       10,    250,  'highroller', 9),
  ('wager_25k',  'Tubarão',     'Apostar 25 000 Tostões no total',   'total_wagered',25000, 1500, 'highroller', 10),
  ('bigwin_2k',  'Mega golpe',  'Ganhar 2 000 Tostões num só lance', 'biggest_win',  2000,  400,  'highroller', 11)
on conflict (key) do nothing;
