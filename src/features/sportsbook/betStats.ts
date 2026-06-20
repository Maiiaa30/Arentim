/**
 * Pure helpers for summarising a user's bets — used by the betting-history
 * section and the "you won" home-page popup. No data fetching here; callers
 * pass in the bets from `useMyBets`.
 */
import type { BetWithLegs } from './useSportsbook';

export type BetFilter = 'all' | 'pending' | 'won' | 'lost';

export interface BetSummary {
  /** Number of bets placed (excluding voided/anuladas). */
  total: number;
  /** Total amount staked across all bets. */
  staked: number;
  /** Total returned on winning bets. */
  won: number;
  /** Settled bets that won, as a fraction 0..1 of decided (won + lost) bets. */
  winRate: number;
  pending: number;
  wonCount: number;
  lostCount: number;
}

/** Aggregate summary stats over a list of bets. */
export function summariseBets(bets: readonly BetWithLegs[]): BetSummary {
  let staked = 0;
  let won = 0;
  let pending = 0;
  let wonCount = 0;
  let lostCount = 0;
  for (const b of bets) {
    staked += b.stake;
    if (b.status === 'won') {
      won += b.potential_payout;
      wonCount += 1;
    } else if (b.status === 'lost') {
      lostCount += 1;
    } else if (b.status === 'pending') {
      pending += 1;
    }
  }
  const decided = wonCount + lostCount;
  return {
    total: bets.length,
    staked,
    won,
    winRate: decided > 0 ? wonCount / decided : 0,
    pending,
    wonCount,
    lostCount,
  };
}

/** Filter bets by a tab selection. */
export function filterBets(bets: readonly BetWithLegs[], filter: BetFilter): BetWithLegs[] {
  if (filter === 'all') return [...bets];
  return bets.filter((b) => b.status === filter);
}

/** localStorage key tracking the last settled bet the user has already seen. */
export const LAST_BET_SEEN_KEY = 'arentim:lastBetSeen';

/**
 * Newly-won bets the user hasn't celebrated yet: settled `won` bets whose id is
 * greater than the last id stored under {@link LAST_BET_SEEN_KEY}. Bet ids are
 * monotonic, so the max id is a stable high-water mark.
 */
export function unseenWins(
  bets: readonly BetWithLegs[],
  lastSeenId: number,
): BetWithLegs[] {
  return bets
    .filter((b) => b.status === 'won' && b.id > lastSeenId)
    .sort((a, b) => b.id - a.id);
}

/** The highest bet id present, or 0 for an empty list — the new high-water mark. */
export function maxBetId(bets: readonly BetWithLegs[]): number {
  return bets.reduce((max, b) => (b.id > max ? b.id : max), 0);
}
