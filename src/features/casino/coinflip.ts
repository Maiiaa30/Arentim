/** Coin-flip — even-money double-or-nothing. Pure logic for the UI. */

export type CoinSide = 'heads' | 'tails';

/** Returns the payout (total return) for a stake given the choice and outcome. */
export function coinflipPayout(stake: number, choice: CoinSide, outcome: CoinSide): number {
  return choice === outcome ? stake * 2 : 0;
}
