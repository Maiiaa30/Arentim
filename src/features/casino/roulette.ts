/**
 * European roulette (single 0) — pure logic shared by the UI for display,
 * validation and optimistic results. The SERVER is authoritative: the
 * `play_roulette` RPC re-derives every outcome and payout. This module mirrors
 * that SQL so the client can show correct odds and highlight winners.
 */

export type RouletteColor = 'green' | 'red' | 'black';

export type RouletteBetKind =
  | 'straight'
  | 'split'
  | 'corner'
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'low'
  | 'high'
  | 'dozen1'
  | 'dozen2'
  | 'dozen3'
  | 'col1'
  | 'col2'
  | 'col3';

export interface RouletteBet {
  kind: RouletteBetKind;
  /** Only used by 'straight' (the chosen number 0–36). */
  selection: number | null;
  /** Covered numbers for 'split' (2) and 'corner' (4). */
  numbers?: number[];
  /** Whole-integer Tostões. */
  stake: number;
}

export const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

/** Physical pocket order on a European wheel (used for the spin animation). */
export const WHEEL_SEQUENCE: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export function colorOf(n: number): RouletteColor {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

/** Total-return multiplier (stake included) for a winning bet of this kind. */
export function multiplierFor(kind: RouletteBetKind): number {
  switch (kind) {
    case 'straight':
      return 36;
    case 'split':
      return 18;
    case 'corner':
      return 9;
    case 'dozen1':
    case 'dozen2':
    case 'dozen3':
    case 'col1':
    case 'col2':
    case 'col3':
      return 3;
    default:
      return 2;
  }
}

/** Does a bet win against outcome `n`? Mirrors public.roulette_multiplier. */
export function isWinningBet(kind: RouletteBetKind, selection: number | null, n: number): boolean {
  switch (kind) {
    case 'straight':
      return selection === n;
    case 'split':
    case 'corner':
      return false; // covered numbers live on the bet; resolved in betReturn
    case 'red':
      return n !== 0 && RED_NUMBERS.has(n);
    case 'black':
      return n !== 0 && !RED_NUMBERS.has(n);
    case 'even':
      return n !== 0 && n % 2 === 0;
    case 'odd':
      return n % 2 === 1;
    case 'low':
      return n >= 1 && n <= 18;
    case 'high':
      return n >= 19 && n <= 36;
    case 'dozen1':
      return n >= 1 && n <= 12;
    case 'dozen2':
      return n >= 13 && n <= 24;
    case 'dozen3':
      return n >= 25 && n <= 36;
    case 'col1':
      return n !== 0 && n % 3 === 1;
    case 'col2':
      return n !== 0 && n % 3 === 2;
    case 'col3':
      return n !== 0 && n % 3 === 0;
  }
}

/** Total return for one bet against outcome `n` (0 if it lost). */
export function betReturn(bet: RouletteBet, n: number): number {
  if (bet.kind === 'split' || bet.kind === 'corner') {
    return bet.numbers?.includes(n) ? bet.stake * multiplierFor(bet.kind) : 0;
  }
  return isWinningBet(bet.kind, bet.selection, n) ? bet.stake * multiplierFor(bet.kind) : 0;
}

/** Total payout for a slip of bets against outcome `n`. */
export function slipPayout(bets: readonly RouletteBet[], n: number): number {
  return bets.reduce((sum, b) => sum + betReturn(b, n), 0);
}

/** Total staked across a slip. */
export function totalStake(bets: readonly RouletteBet[]): number {
  return bets.reduce((sum, b) => sum + b.stake, 0);
}

/** A stable cell key identifying a bet position (for chip stacks + dedup). */
export function betCellKey(kind: RouletteBetKind, selection: number | null, numbers?: number[]): string {
  if (numbers && numbers.length) return `${kind}:${[...numbers].sort((a, b) => a - b).join('-')}`;
  return `${kind}:${selection}`;
}
