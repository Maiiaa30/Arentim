import type { Profile } from '@/types/db';

/** Escalating daily reward by streak day (capped at day 7). Mirrors SQL. */
export const DAILY_REWARDS = [10, 15, 25, 35, 50, 70, 100] as const;
export const MAX_STREAK_DAY = 7;

/** Reward for a given streak day (1-based); capped at day 7. */
export function rewardForDay(day: number): number {
  if (day < 1) return 0;
  const idx = Math.min(day, MAX_STREAK_DAY) - 1;
  return DAILY_REWARDS[idx]!;
}

/** Current date as a UTC `YYYY-MM-DD` string, matching Postgres `current_date`. */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function previousDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type BonusStatus = 'claimable' | 'claimed_today' | 'play_required';

export interface BonusState {
  status: BonusStatus;
  /** The streak that results if the bonus is claimed now. */
  prospectiveStreak: number;
  /** Reward available to claim now (0 if not claimable). */
  claimableReward: number;
  /** Streak currently recorded (filled pips). */
  currentStreak: number;
}

/**
 * Derive the client-side bonus state. The server is authoritative on claim;
 * this drives the UI hint (button lit / locked / claimed).
 */
export function deriveBonusState(
  profile: Pick<Profile, 'streak_count' | 'last_played_date' | 'last_claim_date'>,
  today: string = utcToday(),
): BonusState {
  const playedToday = profile.last_played_date === today;
  const claimedToday = profile.last_claim_date === today;

  const prospectiveStreak =
    profile.last_claim_date === previousDay(today) ? profile.streak_count + 1 : 1;

  if (claimedToday) {
    return {
      status: 'claimed_today',
      prospectiveStreak: profile.streak_count,
      claimableReward: 0,
      currentStreak: profile.streak_count,
    };
  }
  if (!playedToday) {
    return {
      status: 'play_required',
      prospectiveStreak,
      claimableReward: rewardForDay(prospectiveStreak),
      currentStreak: profile.streak_count,
    };
  }
  return {
    status: 'claimable',
    prospectiveStreak,
    claimableReward: rewardForDay(prospectiveStreak),
    currentStreak: profile.streak_count,
  };
}
