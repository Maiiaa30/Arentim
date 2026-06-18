import { describe, it, expect } from 'vitest';
import { combineOdds, potentialPayout, marketResult } from './odds';

describe('combineOdds', () => {
  it('multiplies legs and rounds to 4 dp', () => {
    expect(combineOdds([2])).toBe(2);
    expect(combineOdds([2, 1.5])).toBe(3);
    expect(combineOdds([1.65, 2.1, 1.8])).toBe(6.237);
  });
});

describe('potentialPayout', () => {
  it('floors stake times odds', () => {
    expect(potentialPayout(100, 2)).toBe(200);
    expect(potentialPayout(100, 2.1)).toBe(210);
    expect(potentialPayout(33, 3.0)).toBe(99);
    expect(potentialPayout(100, 6.237)).toBe(623); // 623.7 -> 623
  });
});

describe('marketResult', () => {
  it('1x2 from score', () => {
    expect(marketResult('1x2', 2, 0)).toBe('home');
    expect(marketResult('1x2', 1, 1)).toBe('draw');
    expect(marketResult('1x2', 0, 3)).toBe('away');
  });
  it('over/under on the 2.5 line', () => {
    expect(marketResult('ou25', 2, 1)).toBe('over'); // 3 goals
    expect(marketResult('ou25', 1, 1)).toBe('under'); // 2 goals
    expect(marketResult('ou25', 0, 0)).toBe('under');
  });
  it('both teams to score', () => {
    expect(marketResult('btts', 1, 2)).toBe('yes');
    expect(marketResult('btts', 0, 2)).toBe('no');
    expect(marketResult('btts', 3, 0)).toBe('no');
  });
});
