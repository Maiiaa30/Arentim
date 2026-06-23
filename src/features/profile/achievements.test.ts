import { describe, it, expect } from 'vitest';
import { evaluateAchievements, unlockedCount, ACHIEVEMENTS } from './achievements';
import type { Profile } from '@/types/db';

const base: Profile = {
  id: 'u1',
  display_name: 'Tester',
  avatar_url: null,
  balance: 0,
  is_admin: false,
  total_wagered: 0,
  total_won: 0,
  total_lost: 0,
  games_played: 0,
  games_won: 0,
  biggest_win: 0,
  streak_count: 0,
  last_played_date: null,
  last_claim_date: null,
  created_at: '2026-01-01T00:00:00Z',
  last_online: null,
  last_rescue_date: null,
  levels_claimed: 0,
  suspended: false,
  suspended_until: null,
};

describe('achievements', () => {
  it('unlocks nothing for a brand-new profile', () => {
    expect(unlockedCount(base)).toBe(0);
    expect(evaluateAchievements(base).every((a) => !a.unlocked)).toBe(true);
  });

  it('unlocks the first-game achievement after one round', () => {
    const states = evaluateAchievements({ ...base, games_played: 1 });
    const first = states.find((a) => a.key === 'first')!;
    expect(first.unlocked).toBe(true);
    expect(first.pct).toBe(1);
  });

  it('reports partial progress and clamps pct to [0,1]', () => {
    const states = evaluateAchievements({ ...base, games_played: 50 });
    const regular = states.find((a) => a.key === 'regular')!; // target 100
    expect(regular.unlocked).toBe(false);
    expect(regular.pct).toBeCloseTo(0.5);
    const first = states.find((a) => a.key === 'first')!;
    expect(first.pct).toBe(1); // 50 >> target 1, clamped
  });

  it('sorts unlocked achievements before locked ones', () => {
    const states = evaluateAchievements({ ...base, games_played: 1, biggest_win: 1000 });
    const firstLockedIdx = states.findIndex((a) => !a.unlocked);
    expect(states.slice(0, firstLockedIdx).every((a) => a.unlocked)).toBe(true);
  });

  it('counts every catalog entry', () => {
    const maxed: Profile = {
      ...base, games_played: 100000, games_won: 100000, biggest_win: 1e9,
      streak_count: 999, total_wagered: 1e9, balance: 1e9,
    };
    expect(unlockedCount(maxed)).toBe(ACHIEVEMENTS.length);
  });
});
