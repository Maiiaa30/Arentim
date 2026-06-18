import { describe, it, expect } from 'vitest';
import { coinflipPayout } from './coinflip';

describe('coinflipPayout', () => {
  it('doubles the stake on a correct call', () => {
    expect(coinflipPayout(100, 'heads', 'heads')).toBe(200);
    expect(coinflipPayout(50, 'tails', 'tails')).toBe(100);
  });

  it('pays nothing on a wrong call', () => {
    expect(coinflipPayout(100, 'heads', 'tails')).toBe(0);
    expect(coinflipPayout(50, 'tails', 'heads')).toBe(0);
  });
});
