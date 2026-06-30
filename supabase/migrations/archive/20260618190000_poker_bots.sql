-- ============================================================================
-- Arentim — Phase 8b: poker vs bots (server-authoritative dealer state).
--
-- The full table state (deck + bot hole cards) lives here and is driven only by
-- the poker-bots Edge Function (service role). Clients never read this table —
-- they receive a sanitized view from the function. Money flows through
-- apply_ledger_entry: a buy-in debit on sit, a credit of the remaining stack on
-- leave (so net = cash-out − buy-in reconciles in the ledger).
-- ============================================================================

create table if not exists public.poker_bot_tables (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'active' check (status in ('active', 'closed')),
  buy_in      bigint not null check (buy_in > 0),
  state       jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- At most one active table per user.
create unique index if not exists poker_bot_one_active
  on public.poker_bot_tables (user_id) where status = 'active';

alter table public.poker_bot_tables enable row level security;
-- Clients get state only via the Edge Function; deny direct reads (admins may audit).
drop policy if exists poker_bot_admin_select on public.poker_bot_tables;
create policy poker_bot_admin_select on public.poker_bot_tables
  for select to authenticated using (public.is_admin());

-- The dealer (service role) needs to move money through the atomic ledger.
grant execute on function public.apply_ledger_entry(
  uuid, public.transaction_type, bigint, text, text, text, bigint
) to service_role;
