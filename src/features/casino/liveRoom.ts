/**
 * Pure helpers shared by the live-room pages (Crash / Roulette). The crash math
 * MUST mirror the server (SQL crash_mult / crash_advance, k = 0.15) so the
 * client-rendered rocket lands exactly where the server settles.
 */

/** Crash growth rate — must match SQL crash_mult. */
export const CRASH_K = 0.15;

/** Live multiplier at `elapsedSec` since fly-start (mirrors SQL crash_mult). */
export function crashMult(elapsedSec: number): number {
  return Math.max(1, Math.floor(Math.exp(CRASH_K * Math.max(0, elapsedSec)) * 100) / 100);
}

/** Seconds of flight until a given crash point is reached (mirrors crash_advance). */
export function crashFlySeconds(crashPoint: number): number {
  return Math.log(Math.max(crashPoint, 1.0001)) / CRASH_K;
}

/**
 * Whether an auto cash-out target banks a win for a given crash point — the same
 * rule crash_settle_room applies: you win iff your target fires strictly before
 * the bust.
 */
export function autoCashWins(autoTarget: number | null, crashPoint: number): boolean {
  return autoTarget != null && autoTarget < crashPoint;
}

/** Whole seconds remaining until an ISO deadline, given the server-aligned now. */
export function secondsLeft(deadlineIso: string, serverNowMs: number): number {
  return Math.max(0, Math.ceil((new Date(deadlineIso).getTime() - serverNowMs) / 1000));
}
