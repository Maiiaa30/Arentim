-- ============================================================================
-- Arentim — performance: indexes for the hot paths that currently do
-- sequential scans on the fastest-growing table (transactions) and on the
-- membership / referral lookups.
--
-- All additive (CREATE INDEX IF NOT EXISTS) — no data change, safe to re-run.
-- ============================================================================

-- season_leaderboard('global') aggregates the whole ledger for the month with
-- no user_id predicate (20260622700000_season_leaderboard.sql:32). The only
-- existing index is (user_id, created_at) which can't serve it → full scan on
-- every leaderboard view. This (created_at, type) index, covering user_id+amount,
-- lets the monthly window + type filter run index-only.
create index if not exists transactions_created_type_idx
  on public.transactions (created_at, type) include (user_id, amount);

-- casino_activity() big-win ticker (20260622400000_casino_activity.sql), polled
-- every 9s from every open lobby: type='win' AND amount>=1000, newest first.
create index if not exists transactions_bigwin_idx
  on public.transactions (created_at desc)
  where type = 'win' and amount >= 1000;

-- poker/sueca membership tables have only a (table_id, user_id) PK, which can't
-- serve the user_id-only lookups the RLS policies and list_my_* RPCs do.
create index if not exists poker_table_members_user_idx
  on public.poker_table_members (user_id);
create index if not exists sueca_table_members_user_idx
  on public.sueca_table_members (user_id);

-- profiles.referred_by FK is unindexed; my_referral() counts referrals by it
-- (20260626100000_referrals.sql:75) → full profiles scan per referral panel.
create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by) where referred_by is not null;
