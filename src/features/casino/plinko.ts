/**
 * Pure logic for Plinko, mirrored from the play_plinko SQL RPC. The server is
 * authoritative; this drives the UI and is unit-tested (RTP + symmetry).
 *
 * A ball drops through `rows` peg rows; at each row it bounces left (0) or right
 * (1) with p = 0.5. The landing bin = the number of right-bounces, in 0..rows.
 * The bin distribution is therefore Binomial(rows, 0.5):
 *   P(k) = C(rows, k) / 2^rows.
 * Each (rows, risk) pair has a symmetric multiplier table with `rows + 1`
 * entries — high at the edges (rare bins), low in the centre (common bins). The
 * tables are tuned so the RTP = Σ P(k)·mult(k) lands in [0.95, 0.99].
 */

export type PlinkoRows = 8 | 12 | 16;
export type PlinkoRisk = 'low' | 'medium' | 'high';

export interface PlinkoResult {
  path: number[];
  bin: number;
  rows: number;
  risk: string;
  multiplier: number;
  payout: number;
  balance: number;
  replayed: boolean;
}

/**
 * Multiplier tables. Each array has `rows + 1` entries, is symmetric, with the
 * biggest payouts at the edges and the lowest in the centre. 'high' risk pushes
 * the edges up and sinks the centre; 'low' is flatter. These MUST mirror the SQL
 * arrays in 20260625000000_plinko.sql exactly and are pinned by plinko.test.ts.
 */
export const PLINKO_MULT: Record<PlinkoRows, Record<PlinkoRisk, number[]>> = {
  8: {
    low: [4.2, 1.9, 1.2, 0.9, 0.6, 0.9, 1.2, 1.9, 4.2],
    medium: [11, 3, 1.4, 0.7, 0.35, 0.7, 1.4, 3, 11],
    high: [27, 4, 1.4, 0.3, 0.2, 0.3, 1.4, 4, 27],
  },
  12: {
    low: [8, 3, 1.7, 1.3, 1.05, 0.85, 0.7, 0.85, 1.05, 1.3, 1.7, 3, 8],
    medium: [27, 7, 2.9, 1.5, 1, 0.7, 0.6, 0.7, 1, 1.5, 2.9, 7, 27],
    high: [165, 19, 5.5, 1.8, 0.7, 0.4, 0.35, 0.4, 0.7, 1.8, 5.5, 19, 165],
  },
  16: {
    low: [12, 3.6, 2.1, 1.6, 1.3, 1.05, 0.95, 0.9, 0.85, 0.9, 0.95, 1.05, 1.3, 1.6, 2.1, 3.6, 12],
    medium: [70, 17, 5.8, 3, 1.7, 1.2, 0.9, 0.75, 0.7, 0.75, 0.9, 1.2, 1.7, 3, 5.8, 17, 70],
    high: [880, 127, 25, 7, 2.2, 1, 0.6, 0.5, 0.4, 0.5, 0.6, 1, 2.2, 7, 25, 127, 880],
  },
};

/** Binomial coefficient C(n, k) (n ≤ 16, exact in double precision). */
function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c;
}

/** P(bin = k) for a ball dropped through `rows` rows: Binomial(rows, 0.5). */
export function binProbabilities(rows: number): number[] {
  const denom = 2 ** rows;
  const out: number[] = [];
  for (let k = 0; k <= rows; k++) out.push(binom(rows, k) / denom);
  return out;
}

/** The payout multiplier for landing in `bin` (0..rows) at this rows/risk. */
export function plinkoMultiplier(rows: PlinkoRows, risk: PlinkoRisk, bin: number): number {
  const table = PLINKO_MULT[rows][risk];
  return table[bin] ?? 0;
}

/** Return-to-player for a rows/risk table: Σ P(k)·mult(k). */
export function plinkoRtp(rows: PlinkoRows, risk: PlinkoRisk): number {
  const probs = binProbabilities(rows);
  const table = PLINKO_MULT[rows][risk];
  return probs.reduce((acc, p, k) => acc + p * table[k]!, 0);
}

/** Colour-grade a multiplier for the bins: big = gold/red, ~1 = neutral, <1 dim. */
export function plinkoBinColor(mult: number): string {
  if (mult >= 10) return '#C9A24B'; // gold — top edges
  if (mult >= 3) return '#b0303a'; // ruby
  if (mult >= 1.4) return '#c47a2c'; // amber
  if (mult >= 1) return '#2b6f4e'; // green — break-even-ish
  if (mult >= 0.6) return '#4a3b22'; // dim bronze
  return '#2a2620'; // very dim — deep centre loss
}
