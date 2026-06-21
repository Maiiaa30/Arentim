import { describe, expect, it } from 'vitest';

/**
 * Economic mirror of the slot_machines seed in
 * supabase/migrations/20260619030000_slot_machines.sql. Reel strips are encoded
 * as symbol → count (sum must equal the strip length). These tests pin down the
 * return-to-player and jackpot rarity so a careless paytable edit can't quietly
 * wreck the (play-money) economy. Keep in sync with the SQL seed.
 */
type Machine = {
  L: number;
  counts: Record<string, number>;
  pay3: Record<string, number>;
  pay2: Record<string, number>;
  jackpot: string;
};

const MACHINES: Record<string, Machine> = {
  classico: {
    L: 32,
    counts: { cherry: 12, lemon: 9, bell: 5, star: 4, seven: 2 },
    pay3: { cherry: 5, lemon: 8, bell: 18, star: 45, seven: 150 },
    pay2: { cherry: 1 },
    jackpot: 'seven',
  },
  frutaria: {
    L: 36,
    counts: { melon: 12, grape: 9, orange: 7, straw: 5, bell: 2, gem: 1 },
    pay3: { melon: 5, grape: 9, orange: 16, straw: 30, bell: 90, gem: 350 },
    pay2: { melon: 1, grape: 1 },
    jackpot: 'gem',
  },
  tasca: {
    L: 32,
    counts: { sardine: 13, olive: 9, wine: 5, galo: 4, coin: 1 },
    pay3: { sardine: 6, olive: 12, wine: 24, galo: 40, coin: 300 },
    pay2: { coin: 3, galo: 1 },
    jackpot: 'coin',
  },
  pirata: {
    L: 40,
    counts: { parrot: 18, anchor: 12, map: 6, chest: 3, skull: 1 },
    pay3: { parrot: 3, anchor: 14, map: 45, chest: 180, skull: 800 },
    pay2: {},
    jackpot: 'skull',
  },
  aurelia: {
    L: 40,
    counts: { ruby: 18, bell: 12, star: 6, seven: 3, crown: 1 },
    pay3: { ruby: 3, bell: 13, star: 45, seven: 150, crown: 1500 },
    pay2: {},
    jackpot: 'crown',
  },
  // Classic 3-reel "Vegas 777": cherry / BAR×3 / bell / lucky-7.
  vegas: {
    L: 40,
    counts: { cherry: 14, bell: 10, bar: 6, barbar: 4, barbarbar: 4, seven: 2 },
    pay3: { cherry: 4, bell: 12, bar: 25, barbar: 60, barbarbar: 120, seven: 250 },
    pay2: { cherry: 1 },
    jackpot: 'seven',
  },
};

/** Exact RTP by enumerating the (ordered) outcome space of three reels. */
function rtp(m: Machine): number {
  const total = m.L ** 3;
  let num = 0;
  for (const [s, c] of Object.entries(m.counts)) {
    num += c ** 3 * (m.pay3[s] ?? 0); // three of a kind
    num += 3 * c * c * (m.L - c) * (m.pay2[s] ?? 0); // exactly a pair of s
  }
  return num / total;
}

const jackpotOdds = (m: Machine) => m.L ** 3 / m.counts[m.jackpot]! ** 3;

describe('slot machines', () => {
  it('each strip length matches its declared count total', () => {
    for (const [key, m] of Object.entries(MACHINES)) {
      const sum = Object.values(m.counts).reduce((a, b) => a + b, 0);
      expect(sum, `${key} counts sum`).toBe(m.L);
    }
  });

  it('every machine pays back 84–94% (sane play-money house edge)', () => {
    for (const [key, m] of Object.entries(MACHINES)) {
      const r = rtp(m);
      expect(r, `${key} RTP=${(r * 100).toFixed(1)}%`).toBeGreaterThan(0.84);
      expect(r, `${key} RTP=${(r * 100).toFixed(1)}%`).toBeLessThan(0.94);
    }
  });

  it('jackpots are rare but reachable (between 1/3000 and 1/70000)', () => {
    for (const [key, m] of Object.entries(MACHINES)) {
      const odds = jackpotOdds(m);
      expect(odds, `${key} 1/${Math.round(odds)}`).toBeGreaterThan(3000);
      expect(odds, `${key} 1/${Math.round(odds)}`).toBeLessThan(70000);
    }
  });

  it('Aurélia carries the single biggest jackpot on the floor', () => {
    const tops = Object.entries(MACHINES).map(([key, m]) => ({ key, mult: m.pay3[m.jackpot]! }));
    const biggest = tops.reduce((a, b) => (b.mult > a.mult ? b : a));
    expect(biggest.key).toBe('aurelia');
    // and strictly bigger than every other machine's jackpot
    const aureliaTop = MACHINES.aurelia!.pay3.crown!;
    for (const t of tops) if (t.key !== 'aurelia') expect(aureliaTop).toBeGreaterThan(t.mult);
  });

  it('the jackpot symbol is the top-paying symbol on its machine', () => {
    for (const [key, m] of Object.entries(MACHINES)) {
      const max = Math.max(...Object.values(m.pay3));
      expect(m.pay3[m.jackpot], `${key} jackpot is top pay`).toBe(max);
    }
  });
});
