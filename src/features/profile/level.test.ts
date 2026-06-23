import { describe, it, expect } from 'vitest';
import {
  levelThreshold,
  levelFromWagered,
  levelInfo,
  levelReward,
  rewardBetween,
  tierName,
} from './level';

describe('casino level curve', () => {
  it('thresholds match the closed form (mirrored in SQL)', () => {
    expect(levelThreshold(1)).toBe(0);
    expect(levelThreshold(2)).toBe(1500);
    expect(levelThreshold(3)).toBe(3750); // 1500 + 2250
    expect(levelThreshold(4)).toBe(6750); // + 3000
    expect(levelThreshold(10)).toBe(40500);
    expect(levelThreshold(20)).toBe(156750);
  });

  it('thresholds are strictly increasing', () => {
    for (let L = 1; L < 60; L++) {
      expect(levelThreshold(L + 1)).toBeGreaterThan(levelThreshold(L));
    }
  });

  it('maps wagered to the right level at and around floors', () => {
    expect(levelFromWagered(0)).toBe(1);
    expect(levelFromWagered(1499)).toBe(1);
    expect(levelFromWagered(1500)).toBe(2);
    expect(levelFromWagered(3749)).toBe(2);
    expect(levelFromWagered(3750)).toBe(3);
    expect(levelFromWagered(40500)).toBe(10);
  });

  it('levelInfo reports progress within the current level', () => {
    const info = levelInfo(1500); // exactly level 2 floor
    expect(info.level).toBe(2);
    expect(info.intoLevel).toBe(0);
    expect(info.progressPct).toBe(0);
    const mid = levelInfo(1500 + (3750 - 1500) / 2);
    expect(mid.level).toBe(2);
    expect(mid.progressPct).toBe(50);
  });

  it('rewards grow with level and sum correctly', () => {
    expect(levelReward(2)).toBe(120);
    expect(levelReward(3)).toBe(140);
    expect(rewardBetween(1, 3)).toBe(120 + 140);
    expect(rewardBetween(5, 5)).toBe(0);
  });

  it('tier names band by level', () => {
    expect(tierName(1)).toBe('Novato');
    expect(tierName(5)).toBe('Aprendiz');
    expect(tierName(10)).toBe('Habitué');
    expect(tierName(50)).toBe('Mítico');
  });
});
