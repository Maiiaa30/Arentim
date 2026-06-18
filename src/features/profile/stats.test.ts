import { describe, it, expect } from 'vitest';
import { netResult, winRate } from './stats';

describe('netResult', () => {
  it('subtracts losses from wins', () => {
    expect(netResult({ total_won: 1200, total_lost: 800 })).toBe(400);
    expect(netResult({ total_won: 500, total_lost: 900 })).toBe(-400);
    expect(netResult({ total_won: 0, total_lost: 0 })).toBe(0);
  });
});

describe('winRate', () => {
  it('returns 0 with no games played', () => {
    expect(winRate({ games_won: 0, games_played: 0 })).toBe(0);
  });

  it('computes a one-decimal percentage', () => {
    expect(winRate({ games_won: 1, games_played: 2 })).toBe(50);
    expect(winRate({ games_won: 1, games_played: 3 })).toBe(33.3);
    expect(winRate({ games_won: 7, games_played: 10 })).toBe(70);
  });
});
