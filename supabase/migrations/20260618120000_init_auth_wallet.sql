-- ============================================================================
-- Arentim — Phase 2: auth, profiles, wallet ledger.
--
-- Security model (OWASP A01/A06):
--   * Default-deny RLS on every table. A user can read only their own rows.
--   * Money is stored as integer Tostões (bigint), never floats.
--   * The client NEVER mutates balance directly. All balance changes go through
--     the SECURITY DEFINER function `apply_ledger_entry`, which locks the
--     profile row, enforces invariants, writes a transaction, and is callable
--     only by trusted server code (service_role / Edge Functions) — execute is
--     revoked from anon and authenticated.
--   * The ledger reconciles: balance always equals the sum of transaction
--     amounts for a user (seeded by the welcome-bonus row on signup).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum (
      'bonus',      -- daily bonus, welcome bonus
      'bet',        -- stake placed (debit)
      'win',        -- payout (credit)
      'loss',       -- explicit loss marker (no credit; bets already debited)
      'refund',     -- cancelled bet returned
      'adjustment'  -- admin credit/debit (audited)
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- profiles — one row per auth user
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text not null,
  avatar_url      text,
  balance         bigint not null default 5000
                    check (balance >= 0 and balance <= 1000000000000),
  is_admin        boolean not null default false,

  -- Lifetime aggregates (maintained transactionally by apply_ledger_entry).
  total_wagered   bigint not null default 0 check (total_wagered >= 0),
  total_won       bigint not null default 0 check (total_won >= 0),
  total_lost      bigint not null default 0 check (total_lost >= 0),
  games_played    integer not null default 0 check (games_played >= 0),
  games_won       integer not null default 0 check (games_won >= 0),
  biggest_win     bigint not null default 0 check (biggest_win >= 0),

  -- Daily streak (play-gated bonus, Phase 4).
  streak_count    integer not null default 0 check (streak_count >= 0),
  last_played_date date,
  last_claim_date  date,

  created_at      timestamptz not null default now(),
  last_online     timestamptz,

  constraint display_name_len check (char_length(display_name) between 3 and 24)
);

create unique index if not exists profiles_display_name_lower_idx
  on public.profiles (lower(display_name));

-- ----------------------------------------------------------------------------
-- transactions — immutable ledger
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            public.transaction_type not null,
  game            text,
  amount          bigint not null,          -- signed: credit (+) / debit (-)
  balance_after   bigint not null check (balance_after >= 0),
  note            text,
  -- Idempotency: a settlement/payout can be applied at most once (A06).
  idempotency_key text,
  created_at      timestamptz not null default now()
);

create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc);

create unique index if not exists transactions_idempotency_key_idx
  on public.transactions (idempotency_key)
  where idempotency_key is not null;

-- ============================================================================
-- Row Level Security — enable + default deny on every table
-- ============================================================================
alter table public.profiles     enable row level security;
alter table public.transactions enable row level security;
-- NB: we intentionally do NOT `force row level security`. Application clients
-- only ever connect as the `anon`/`authenticated` roles (always subject to RLS)
-- or `service_role` (which bypasses RLS by design for trusted Edge Functions).
-- Forcing RLS would also subject the table owner — and therefore the
-- SECURITY DEFINER `is_admin()` helper that reads `profiles` — to these
-- policies, creating a recursive policy evaluation. ENABLE alone fully protects
-- every client role.

-- Admin check helper. SECURITY DEFINER so it reads profiles as the table owner
-- (bypassing RLS), which both answers the check and avoids recursing into the
-- profiles policy that calls it.
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- profiles: a user reads their own row; admins read all. No direct writes.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- transactions: a user reads their own ledger; admins read all. No direct writes.
drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own on public.transactions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ============================================================================
-- New-user provisioning: create a profile + seed the welcome bonus.
-- ============================================================================
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_name text;
  v_starting bigint := 5000;
begin
  -- Prefer the display name supplied at signup; fall back to a unique stub.
  v_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  if v_name is null then
    v_name := 'Player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  insert into public.profiles (id, display_name, balance)
  values (new.id, v_name, v_starting);

  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (new.id, 'bonus', v_starting, v_starting, 'Welcome bonus');

  return new;
exception
  when unique_violation then
    -- Display name collision: retry with a disambiguating suffix.
    v_name := substr(v_name, 1, 18) || '_' || substr(replace(new.id::text, '-', ''), 1, 5);
    insert into public.profiles (id, display_name, balance)
    values (new.id, v_name, v_starting);
    insert into public.transactions (user_id, type, amount, balance_after, note)
    values (new.id, 'bonus', v_starting, v_starting, 'Welcome bonus');
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- apply_ledger_entry — the ONLY way money moves. Atomic + locked + idempotent.
-- Trusted server code only (service_role / Edge Functions). Execute is revoked
-- from anon and authenticated so clients can never call it via PostgREST.
-- ============================================================================
create or replace function public.apply_ledger_entry(
  p_user_id          uuid,
  p_type             public.transaction_type,
  p_amount           bigint,           -- signed: credit (+) / debit (-)
  p_game             text default null,
  p_note             text default null,
  p_idempotency_key  text default null,
  p_wager            bigint default 0  -- amount to add to total_wagered (>= 0)
)
  returns public.transactions
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_balance     bigint;
  v_new_balance bigint;
  v_existing    public.transactions;
  v_tx          public.transactions;
begin
  if p_wager < 0 then
    raise exception 'wager cannot be negative';
  end if;

  -- Idempotency: if this key was already applied, return the original row.
  if p_idempotency_key is not null then
    select * into v_existing
      from public.transactions
     where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  -- Lock the profile row for the duration of the transaction to serialize
  -- concurrent mutations (prevents double-spend / lost updates).
  select balance into v_balance
    from public.profiles
   where id = p_user_id
   for update;

  if not found then
    raise exception 'profile % not found', p_user_id;
  end if;

  v_new_balance := v_balance + p_amount;

  if v_new_balance < 0 then
    raise exception 'insufficient balance: have %, need %', v_balance, -p_amount
      using errcode = 'check_violation';
  end if;
  if v_new_balance > 1000000000000 then
    raise exception 'balance overflow' using errcode = 'check_violation';
  end if;

  insert into public.transactions (user_id, type, game, amount, balance_after, note, idempotency_key)
  values (p_user_id, p_type, p_game, p_amount, v_new_balance, p_note, p_idempotency_key)
  returning * into v_tx;

  update public.profiles
     set balance        = v_new_balance,
         total_wagered  = total_wagered + p_wager,
         total_won      = total_won + (case when p_type = 'win' and p_amount > 0 then p_amount else 0 end),
         total_lost     = total_lost + (case when p_amount < 0 and p_type in ('bet','loss') then -p_amount else 0 end),
         biggest_win    = greatest(biggest_win, case when p_type = 'win' then p_amount else 0 end),
         games_played   = games_played + (case when p_wager > 0 then 1 else 0 end),
         games_won      = games_won + (case when p_type = 'win' and p_amount > 0 then 1 else 0 end)
   where id = p_user_id;

  return v_tx;
end;
$$;

revoke all on function public.apply_ledger_entry(uuid, public.transaction_type, bigint, text, text, text, bigint) from public;
revoke all on function public.apply_ledger_entry(uuid, public.transaction_type, bigint, text, text, text, bigint) from anon;
revoke all on function public.apply_ledger_entry(uuid, public.transaction_type, bigint, text, text, text, bigint) from authenticated;

-- ============================================================================
-- update_own_profile — the only client-callable profile mutation.
-- Lets a user change ONLY their display name / avatar — never balance,
-- is_admin, or stats. Scoped to auth.uid(); ignores any other id.
-- ============================================================================
create or replace function public.update_own_profile(
  p_display_name text default null,
  p_avatar_url   text default null
)
  returns public.profiles
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_profile public.profiles;
  v_name    text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_name := nullif(trim(p_display_name), '');
  if v_name is not null and char_length(v_name) not between 3 and 24 then
    raise exception 'display name must be 3-24 characters';
  end if;

  update public.profiles
     set display_name = coalesce(v_name, display_name),
         avatar_url   = coalesce(nullif(trim(p_avatar_url), ''), avatar_url)
   where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'profile not found';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.update_own_profile(text, text) from public;
grant execute on function public.update_own_profile(text, text) to authenticated;

-- ============================================================================
-- touch_last_online — lightweight presence heartbeat (own row only).
-- ============================================================================
create or replace function public.touch_last_online()
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.profiles set last_online = now() where id = auth.uid();
end;
$$;

revoke all on function public.touch_last_online() from public;
grant execute on function public.touch_last_online() to authenticated;
