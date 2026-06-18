import { describe, it, expect } from 'vitest';
import { rewardForDay, deriveBonusState } from './dailyBonus';

describe('rewardForDay', () => {
  it('follows the escalating table and caps at day 7', () => {
    expect(rewardForDay(1)).toBe(100);
    expect(rewardForDay(2)).toBe(150);
    expect(rewardForDay(3)).toBe(225);
    expect(rewardForDay(7)).toBe(800);
    expect(rewardForDay(8)).toBe(800);
    expect(rewardForDay(99)).toBe(800);
    expect(rewardForDay(0)).toBe(0);
  });
});

describe('deriveBonusState', () => {
  const today = '2026-06-18';
  const yesterday = '2026-06-17';
  const older = '2026-06-10';

  it('locks the bonus until a qualifying play today', () => {
    const s = deriveBonusState(
      { streak_count: 2, last_played_date: yesterday, last_claim_date: yesterday },
      today,
    );
    expect(s.status).toBe('play_required');
  });

  it('is claimable after playing today, continuing the streak', () => {
    const s = deriveBonusState(
      { streak_count: 2, last_played_date: today, last_claim_date: yesterday },
      today,
    );
    expect(s.status).toBe('claimable');
    expect(s.prospectiveStreak).toBe(3);
    expect(s.claimableReward).toBe(225);
  });

  it('resets the streak after a missed day', () => {
    const s = deriveBonusState(
      { streak_count: 5, last_played_date: today, last_claim_date: older },
      today,
    );
    expect(s.status).toBe('claimable');
    expect(s.prospectiveStreak).toBe(1);
    expect(s.claimableReward).toBe(100);
  });

  it('reflects an already-claimed day', () => {
    const s = deriveBonusState(
      { streak_count: 3, last_played_date: today, last_claim_date: today },
      today,
    );
    expect(s.status).toBe('claimed_today');
    expect(s.claimableReward).toBe(0);
    expect(s.currentStreak).toBe(3);
  });

  it('treats a never-claimed player who played today as a fresh streak', () => {
    const s = deriveBonusState(
      { streak_count: 0, last_played_date: today, last_claim_date: null },
      today,
    );
    expect(s.status).toBe('claimable');
    expect(s.prospectiveStreak).toBe(1);
  });
});
