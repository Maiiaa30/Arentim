import { describe, it, expect } from 'vitest';
import {
  diceMultiplier,
  hiloAdaptedMult,
  highlowMultiplier,
  WHEEL,
  wheelMultiplier,
  wheelRtp,
  crashPoint,
  crashWon,
} from './miniGames';

describe('dados (dice)', () => {
  it('pays Over on 8-12, Under on 2-6, nothing on 7', () => {
    expect(diceMultiplier('over', 8)).toBe(2.3);
    expect(diceMultiplier('over', 7)).toBe(0);
    expect(diceMultiplier('under', 6)).toBe(2.3);
    expect(diceMultiplier('under', 7)).toBe(0);
  });
  it('pays Seven only on exactly 7', () => {
    expect(diceMultiplier('seven', 7)).toBe(5.5);
    expect(diceMultiplier('seven', 6)).toBe(0);
    expect(diceMultiplier('seven', 8)).toBe(0);
  });
});

describe('sobe e desce (adaptive hi-lo)', () => {
  it('pays more for the less likely side; impossible side pays 0', () => {
    // On 8: 5 numbers above (Sobe), 7 below (Desce) — Sobe pays more.
    const sobe8 = hiloAdaptedMult(13 - 8); // count 5
    const desce8 = hiloAdaptedMult(8 - 1); // count 7
    expect(sobe8).toBeGreaterThan(desce8);
    expect(sobe8).toBeCloseTo(2.28, 2);
    expect(desce8).toBeCloseTo(1.63, 2);
    expect(hiloAdaptedMult(0)).toBe(0); // e.g. Sobe on 13
  });
  it('keeps a house edge (EV ≈ 0.95 on every count)', () => {
    for (const count of [1, 3, 5, 7, 11, 12]) {
      const ev = (count / 12) * hiloAdaptedMult(count);
      expect(ev).toBeGreaterThan(0.93);
      expect(ev).toBeLessThan(0.97);
    }
  });
});

describe('roda da sorte (wheel)', () => {
  it('has 24 segments', () => {
    expect(WHEEL).toHaveLength(24);
  });
  it('wraps the index safely', () => {
    expect(wheelMultiplier(0)).toBe(WHEEL[0]);
    expect(wheelMultiplier(24)).toBe(WHEEL[0]);
    expect(wheelMultiplier(-1)).toBe(WHEEL[23]);
  });
  it('keeps a house edge (RTP between 0.9 and 0.97)', () => {
    const rtp = wheelRtp();
    expect(rtp).toBeGreaterThan(0.9);
    expect(rtp).toBeLessThan(0.97);
  });
});

describe('maior ou menor (high/low die)', () => {
  it('High wins 4-6, Low wins 1-3 at 1.9x; exact pays 5.7x', () => {
    expect(highlowMultiplier('high', 4)).toBe(1.9);
    expect(highlowMultiplier('high', 3)).toBe(0);
    expect(highlowMultiplier('low', 3)).toBe(1.9);
    expect(highlowMultiplier('low', 4)).toBe(0);
    expect(highlowMultiplier('5', 5)).toBe(5.7);
    expect(highlowMultiplier('5', 4)).toBe(0);
  });
  it('keeps a house edge', () => {
    expect(0.5 * 1.9).toBeLessThan(1); // high/low EV
    expect((1 / 6) * 5.7).toBeLessThan(1); // exact EV
  });
});

describe('crash', () => {
  it('grows the crash point as u rises, capped at 1000', () => {
    expect(crashPoint(0)).toBe(1); // clamped to 1.00 → any target busts instantly
    expect(crashPoint(0.5)).toBeCloseTo(1.92, 2);
    expect(crashPoint(0.999999)).toBe(1000);
  });
  it('wins only when the target is reached', () => {
    expect(crashWon(2, 2.5)).toBe(true);
    expect(crashWon(2, 2)).toBe(true);
    expect(crashWon(2, 1.99)).toBe(false);
  });
  it('averages a ~4% house edge over many rounds at a fixed target', () => {
    // EV at target t is P(crash>=t)*t; with crash=0.96/(1-u) this is ~0.96.
    const t = 2;
    let ret = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N; // even sweep of [0,1)
      ret += crashWon(t, crashPoint(u)) ? t : 0;
    }
    expect(ret / N).toBeGreaterThan(0.9);
    expect(ret / N).toBeLessThan(1.0);
  });
});
