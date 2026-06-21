import { describe, it, expect } from 'vitest';

// These mirror the SQL constants/formulas (source of truth lives in the
// migrations). The point of the tests is to pin the intended ~0.95 RTP / fair
// multipliers so an accidental tweak that breaks the economy is caught.

/** Mines fair multiplier after k safe reveals (mirrors mines_mult). */
function minesMult(k: number, mines: number): number {
  if (k <= 0) return 1;
  let m = 1;
  for (let i = 0; i < k; i++) m *= (25 - i) / (25 - mines - i);
  return Math.floor(0.97 * m * 100) / 100;
}

/** Chicken fair multiplier after k lanes (mirrors chicken_mult). */
function chickenMult(k: number, s: number): number {
  return k <= 0 ? 1 : Math.floor(0.97 * Math.pow(1 / s, k) * 100) / 100;
}

describe('Mines economics', () => {
  it('is 1.0 before any pick and grows with each safe reveal', () => {
    expect(minesMult(0, 3)).toBe(1);
    let prev = 1;
    for (let k = 1; k <= 22; k++) {
      const m = minesMult(k, 3);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });
  it('pays more with more mines for the same reveals', () => {
    expect(minesMult(1, 8)).toBeGreaterThan(minesMult(1, 1));
  });
  it('keeps a house edge on the very first pick (< fair 25/(25-m))', () => {
    expect(minesMult(1, 3)).toBeLessThan(25 / 22);
  });
});

describe('Chicken economics', () => {
  it('grows with lanes and difficulty', () => {
    expect(chickenMult(0, 0.82)).toBe(1);
    expect(chickenMult(1, 0.82)).toBeGreaterThan(1);
    expect(chickenMult(1, 0.45)).toBeGreaterThan(chickenMult(1, 0.82)); // harder pays more
  });
});

describe('Tigrinho RTP (3 paylines)', () => {
  it('is deliberately stingy (~0.82 — the tiger eats your money)', () => {
    const w = [1, 2, 3, 4, 5, 6];
    const mult = [205, 82, 49, 25, 15, 9]; // mirrors 20260624000000_tigrinho_rtp
    const total = w.reduce((a, b) => a + b, 0); // 21
    // RTP = E[line mult] = Σ (w/total)^3 · mult
    const rtp = w.reduce((acc, wi, i) => acc + Math.pow(wi / total, 3) * mult[i]!, 0);
    expect(rtp).toBeGreaterThan(0.79);
    expect(rtp).toBeLessThan(0.85);
  });
});

describe('Corrida de Cavalos RTP', () => {
  it('gives every horse ~0.95 RTP', () => {
    const odds = [2.4, 4, 6, 9, 14, 28];
    const weights = [4167, 2500, 1667, 1111, 714, 357];
    const total = weights.reduce((a, b) => a + b, 0); // 10516
    odds.forEach((o, i) => {
      const ev = (weights[i]! / total) * o;
      expect(ev).toBeGreaterThan(0.94);
      expect(ev).toBeLessThan(0.96);
    });
  });
});
