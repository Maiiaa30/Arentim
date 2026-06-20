/**
 * Pure logic for the one-shot mini-games (Dados, Sobe e Desce, Roda da Sorte,
 * Crash), mirrored from the SQL RPCs. The server is authoritative; this drives
 * the UI and is unit-tested (payouts + wheel RTP).
 */

export type DicePick = 'over' | 'under' | 'seven';
export type HiLoPick = 'sobe' | 'desce';

/** Total-return multiplier for a dice bet given the rolled sum (2..12). */
export function diceMultiplier(pick: DicePick, sum: number): number {
  if (pick === 'over' && sum >= 8) return 2.3;
  if (pick === 'under' && sum <= 6) return 2.3;
  if (pick === 'seven' && sum === 7) return 5.5;
  return 0;
}

/**
 * Sobe e Desce adapted multiplier: the next number is one of the 12 rungs other
 * than the current, so a side with `count` winning rungs pays 12/count (×0.95
 * for the house edge). Mirrors hilo_mult() in SQL. Returns 0 for an impossible
 * side (count 0).
 */
export function hiloAdaptedMult(count: number): number {
  return count > 0 ? Math.round((0.95 * 12) / count * 100) / 100 : 0;
}

/**
 * The 24-segment lucky wheel (each segment equally likely). 0 = lose, but most
 * segments pay something so the wheel doesn't feel empty: 9 half-backs, 6×1.5,
 * 2×2, one 5× jackpot, only 6 blanks. RTP ≈ 0.94.
 * MUST match the v_wheel array in 20260620600000_wheel_rebalance.sql.
 */
export const WHEEL: readonly number[] = [
  0.5, 1.5, 0, 0.5, 2, 0.5, 1.5, 0, 0.5, 1.5, 0.5, 5, 0.5, 1.5, 0, 0.5, 2, 1.5, 0.5, 0, 1.5, 0.5, 0, 0,
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

export type HighLowPick = 'high' | 'low' | '1' | '2' | '3' | '4' | '5' | '6';

/** Single-die High/Low multiplier. High = 4-6, Low = 1-3 (1.9×); exact = 5.7×. */
export function highlowMultiplier(pick: HighLowPick, die: number): number {
  if (pick === 'high' && die >= 4) return 1.9;
  if (pick === 'low' && die <= 3) return 1.9;
  if (/^[1-6]$/.test(pick) && die === Number(pick)) return 5.7;
  return 0;
}

/**
 * The 9 treasure-chest values, shuffled server-side each round. Mostly empty
 * with one 5×. Mirrors v_vals in 20260621100000_chest_highlow.sql. RTP ≈ 0.94.
 */
export const CHEST_VALUES: readonly number[] = [0, 0, 0, 0, 0.5, 0.5, 1, 1.5, 5];

export function chestRtp(): number {
  return CHEST_VALUES.reduce((a, b) => a + b, 0) / CHEST_VALUES.length;
}

/** Distinct accent colour per wheel multiplier, for the wheel rendering. */
export function wheelColor(mult: number): string {
  if (mult === 0) return '#1a1712'; // blank
  if (mult >= 5) return '#C9A24B'; // jackpot — gold
  if (mult >= 2) return '#b0303a'; // ruby
  if (mult >= 1.5) return '#2b6f4e'; // green
  return '#4a3b22'; // half-back — dim bronze
}
