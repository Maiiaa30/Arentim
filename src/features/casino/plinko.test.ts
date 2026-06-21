import { describe, it, expect } from 'vitest';
import {
  PLINKO_MULT,
  binProbabilities,
  plinkoMultiplier,
  plinkoRtp,
  type PlinkoRows,
  type PlinkoRisk,
} from './plinko';

const ROWS: PlinkoRows[] = [8, 12, 16];
const RISKS: PlinkoRisk[] = ['low', 'medium', 'high'];

describe('plinko bin probabilities', () => {
  it.each(ROWS)('Binomial(%i, 0.5) sums to 1 and has rows+1 entries', (rows) => {
    const p = binProbabilities(rows);
    expect(p).toHaveLength(rows + 1);
    const sum = p.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 12);
    // The distribution is symmetric about the centre.
    for (let k = 0; k <= rows; k++) expect(p[k]).toBeCloseTo(p[rows - k]!, 12);
    // P(k) = C(rows,k)/2^rows: the centre is the mode.
    const mid = rows / 2;
    expect(p[mid]).toBeGreaterThan(p[0]!);
  });
});

describe('plinko multiplier tables', () => {
  for (const rows of ROWS) {
    for (const risk of RISKS) {
      const table = PLINKO_MULT[rows][risk];

      it(`${rows}/${risk}: has rows+1 entries`, () => {
        expect(table).toHaveLength(rows + 1);
      });

      it(`${rows}/${risk}: is symmetric`, () => {
        for (let k = 0; k <= rows; k++) {
          expect(table[k]).toBe(table[rows - k]);
        }
      });

      it(`${rows}/${risk}: edges pay more than the centre`, () => {
        const mid = rows / 2;
        expect(table[0]).toBeGreaterThan(table[mid]!);
      });

      it(`${rows}/${risk}: plinkoMultiplier mirrors the table`, () => {
        for (let bin = 0; bin <= rows; bin++) {
          expect(plinkoMultiplier(rows, risk, bin)).toBe(table[bin]);
        }
      });

      it(`${rows}/${risk}: RTP is in [0.95, 0.99]`, () => {
        const rtp = plinkoRtp(rows, risk);
        expect(rtp).toBeGreaterThanOrEqual(0.95);
        expect(rtp).toBeLessThanOrEqual(0.99);
      });
    }
  }
});
