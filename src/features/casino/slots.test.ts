import { describe, it, expect } from 'vitest';
import { REEL_STRIP, slotsMultiplier, type SlotSymbol } from './slots';

describe('slotsMultiplier', () => {
  it('pays three-of-a-kind', () => {
    expect(slotsMultiplier('coin', 'coin', 'coin')).toBe(100);
    expect(slotsMultiplier('sardine', 'sardine', 'sardine')).toBe(7);
  });

  it('pays premium pairs only', () => {
    expect(slotsMultiplier('coin', 'coin', 'wine')).toBe(3);
    expect(slotsMultiplier('seven', 'galo', 'seven')).toBe(1);
    expect(slotsMultiplier('galo', 'galo', 'coin')).toBe(0); // galo pair pays nothing
    expect(slotsMultiplier('wine', 'wine', 'coin')).toBe(0);
    expect(slotsMultiplier('sardine', 'sardine', 'coin')).toBe(0);
  });

  it('pays nothing with no match', () => {
    expect(slotsMultiplier('coin', 'seven', 'galo')).toBe(0);
  });
});

describe('return to player', () => {
  it('keeps a house edge: 0.8 < RTP < 1.0', () => {
    // Brute-force every weighted reel combination (16^3 = 4096) and average the
    // multiplier — this is the exact expected return per unit staked.
    let total = 0;
    let count = 0;
    for (const a of REEL_STRIP) {
      for (const b of REEL_STRIP) {
        for (const c of REEL_STRIP) {
          total += slotsMultiplier(a as SlotSymbol, b as SlotSymbol, c as SlotSymbol);
          count += 1;
        }
      }
    }
    const rtp = total / count;
    expect(count).toBe(16 ** 3);
    expect(rtp).toBeGreaterThan(0.8);
    expect(rtp).toBeLessThan(1.0); // the house must keep an edge
  });
});
