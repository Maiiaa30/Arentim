import type { Profile } from '@/types/db';

/** Net result = total won minus total lost (may be negative). */
export function netResult(p: Pick<Profile, 'total_won' | 'total_lost'>): number {
  return p.total_won - p.total_lost;
}

/**
 * Win rate as a percentage of games played, 0–100, rounded to one decimal.
 * Returns 0 when no games have been played (avoids divide-by-zero).
 */
export function winRate(p: Pick<Profile, 'games_won' | 'games_played'>): number {
  if (p.games_played <= 0) return 0;
  return Math.round((p.games_won / p.games_played) * 1000) / 10;
}
