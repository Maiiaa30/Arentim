-- ============================================================================
-- Arentim — poker_tables optimistic-concurrency version column.
--
-- The poker-table Edge Function does load → mutate-in-memory → persist with a
-- plain `.update({state}).eq('id',id)` (no guard), so two concurrent requests
-- (e.g. a player acting while the lazy turn-timeout sweep also writes) race
-- last-writer-wins and can desync the hand. This adds an integer `version` so
-- the function can persist with a compare-and-set
-- (`.eq('id',id).eq('version',v)`) and retry from a reload on a 0-row conflict.
-- Money was already safe (idempotent ledger keys + the membership-PK buy-in
-- guard); this protects the in-memory game state.
--
-- Additive + idempotent. The Edge Function must be redeployed to use it
-- (`npm run deploy:functions poker-table`); until then nothing changes.
-- ============================================================================

alter table public.poker_tables add column if not exists version int not null default 0;
