/**
 * Money primitives for Arentim.
 *
 * Currency (Tostões) is ALWAYS represented as a non-negative integer number of
 * whole Tostões. Never use floats for money (A06: Insecure Design). These helpers
 * are pure and shared between the client (for optimistic display) and the
 * server-side economy logic, but the server is always authoritative — the client
 * never awards itself balance.
 */

/** The largest balance we allow, as a guard against overflow / absurd values. */
export const MAX_TOSTOES = 1_000_000_000_000; // 1 trillion

/** Starting balance for a new account. */
export const STARTING_BALANCE = 5_000;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** A value is valid currency only if it is a finite, non-negative, in-range integer. */
export function isValidAmount(value: number): boolean {
  return (
    Number.isInteger(value) && value >= 0 && value <= MAX_TOSTOES && Number.isFinite(value)
  );
}

/** Assert a value is a usable stake/amount, throwing a MoneyError otherwise. */
export function assertValidAmount(value: number, label = 'amount'): number {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} must be a whole number of Tostões`);
  }
  if (value < 0) {
    throw new MoneyError(`${label} cannot be negative`);
  }
  if (value > MAX_TOSTOES) {
    throw new MoneyError(`${label} exceeds the maximum allowed`);
  }
  return value;
}

/** A stake must be a strictly positive, in-range integer. */
export function assertValidStake(stake: number): number {
  assertValidAmount(stake, 'stake');
  if (stake <= 0) {
    throw new MoneyError('stake must be greater than zero');
  }
  return stake;
}

/** Can `balance` cover `stake`? Both must already be valid integers. */
export function canAfford(balance: number, stake: number): boolean {
  return isValidAmount(balance) && isValidAmount(stake) && stake > 0 && balance >= stake;
}

/** Add two amounts, guarding against overflow. Returns a valid integer or throws. */
export function add(a: number, b: number): number {
  const result = a + b;
  return assertValidAmount(result, 'balance');
}

/** Subtract `b` from `a`, refusing to produce a negative balance. */
export function subtract(a: number, b: number): number {
  const result = a - b;
  if (result < 0) {
    throw new MoneyError('operation would produce a negative balance');
  }
  return assertValidAmount(result, 'balance');
}

/**
 * Compute a payout from a stake and decimal odds, rounding DOWN to whole Tostões.
 *
 * Decimal odds are quoted to two places, so we convert to integer hundredths and
 * do the multiplication in integer space before dividing — this avoids floating
 * point drift (e.g. 100 * 1.91 must be exactly 191, never 190.999…). Floor at the
 * end so the economy never rounds in the player's favour.
 */
export function payoutFromOdds(stake: number, decimalOdds: number): number {
  assertValidStake(stake);
  if (!Number.isFinite(decimalOdds) || decimalOdds < 1) {
    throw new MoneyError('decimal odds must be >= 1');
  }
  const oddsHundredths = Math.round(decimalOdds * 100);
  return assertValidAmount(Math.floor((stake * oddsHundredths) / 100), 'payout');
}
