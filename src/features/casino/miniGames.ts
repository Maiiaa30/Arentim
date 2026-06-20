/**
 * Pure logic for the one-shot mini-games (Dados, Sobe e Desce, Roda da Sorte,
 * Crash), mirrored from the SQL RPCs. The server is authoritative; this drives
 * the UI and is unit-tested (payouts + wheel RTP).
 */

export type DicePick = 'over' | 'under' | 'seven';
export type HiLoPick = 'sobe' | 'desce' | 'sete';

/** Total-return multiplier for a dice bet given the rolled sum (2..12). */
export function diceMultiplier(pick: DicePick, sum: number): number {
  if (pick === 'over' && sum >= 8) return 2.3;
  if (pick === 'under' && sum <= 6) return 2.3;
  if (pick === 'seven' && sum === 7) return 5.5;
  return 0;
}

/** Total-return multiplier for a Sobe e Desce bet given the rung (1..13). */
export function hiloMultiplier(pick: HiLoPick, n: number): number {
  if (pick === 'sobe' && n >= 8) return 2;
  if (pick === 'desce' && n <= 6) return 2;
  if (pick === 'sete' && n === 7) return 12;
  return 0;
}

/**
 * The 24-segment lucky wheel (each segment equally likely). 0 = lose.
 * MUST match the v_wheel array in 20260620500000_mini_games.sql.
 */
export const WHEEL: readonly number[] = [
  0, 1.2, 0, 1.5, 0, 1.2, 0, 3, 0, 1.5, 0, 1.2, 0, 10, 0, 1.5, 0, 1.2, 0, 0, 0, 0, 0, 0,
];

export function wheelMultiplier(index: number): number {
  return WHEEL[((index % WHEEL.length) + WHEEL.length) % WHEEL.length]!;
}

/** Average return per unit staked across the wheel (its RTP). */
export function wheelRtp(): number {
  return WHEEL.reduce((a, b) => a + b, 0) / WHEEL.length;
}

/** The crash point for a uniform u in [0,1): 0.96/(1-u), floored to 2dp, ≤1000. */
export function crashPoint(u: number): number {
  const raw = Math.min(1000, 0.96 / (1 - u));
  return Math.floor(Math.max(1, raw) * 100) / 100;
}

/** A crash round resolves to a win iff the chosen target was reached. */
export function crashWon(target: number, crash: number): boolean {
  return target <= crash;
}

/** Distinct accent colour per wheel multiplier, for the wheel rendering. */
export function wheelColor(mult: number): string {
  if (mult === 0) return '#1a1712';
  if (mult >= 10) return '#C9A24B';
  if (mult >= 3) return '#b0303a';
  if (mult >= 1.5) return '#2b6f4e';
  return '#3a5a8c';
}
