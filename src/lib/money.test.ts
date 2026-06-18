import { describe, it, expect } from 'vitest';
import {
  MAX_TOSTOES,
  MoneyError,
  add,
  assertValidStake,
  canAfford,
  isValidAmount,
  payoutFromOdds,
  subtract,
} from './money';

describe('isValidAmount', () => {
  it('accepts non-negative in-range integers', () => {
    expect(isValidAmount(0)).toBe(true);
    expect(isValidAmount(5000)).toBe(true);
    expect(isValidAmount(MAX_TOSTOES)).toBe(true);
  });

  it('rejects floats, negatives and out-of-range values', () => {
    expect(isValidAmount(10.5)).toBe(false);
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidAmount(MAX_TOSTOES + 1)).toBe(false);
    expect(isValidAmount(Number.NaN)).toBe(false);
    expect(isValidAmount(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('assertValidStake', () => {
  it('requires a strictly positive integer', () => {
    expect(assertValidStake(1)).toBe(1);
    expect(() => assertValidStake(0)).toThrow(MoneyError);
    expect(() => assertValidStake(-5)).toThrow(MoneyError);
    expect(() => assertValidStake(2.5)).toThrow(MoneyError);
  });
});

describe('canAfford', () => {
  it('is true only when balance covers a positive stake', () => {
    expect(canAfford(100, 100)).toBe(true);
    expect(canAfford(100, 101)).toBe(false);
    expect(canAfford(100, 0)).toBe(false);
    expect(canAfford(100, -10)).toBe(false);
  });
});

describe('add / subtract', () => {
  it('adds within range', () => {
    expect(add(100, 50)).toBe(150);
  });

  it('refuses to overflow', () => {
    expect(() => add(MAX_TOSTOES, 1)).toThrow(MoneyError);
  });

  it('subtracts without going negative', () => {
    expect(subtract(100, 40)).toBe(60);
    expect(() => subtract(40, 100)).toThrow(MoneyError);
  });
});

describe('payoutFromOdds', () => {
  it('rounds down to whole Tostões', () => {
    expect(payoutFromOdds(100, 2.5)).toBe(250);
    expect(payoutFromOdds(33, 3.0)).toBe(99);
    // Integer-space math keeps this exact: 100 * 1.91 = 191, never 190.999…
    expect(payoutFromOdds(100, 1.91)).toBe(191);
    // Fractional remainder is floored, not rounded up.
    expect(payoutFromOdds(7, 1.35)).toBe(9); // 7 * 1.35 = 9.45 -> 9
  });

  it('rejects odds below 1', () => {
    expect(() => payoutFromOdds(100, 0.9)).toThrow(MoneyError);
  });
});
