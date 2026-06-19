import { describe, expect, it } from 'vitest';
import { YEARS, getSeason, yearsInRange } from './onzeData';

const LINES = ['GK', 'DF', 'MF', 'FW'];

describe('onze dataset (real Liga Portugal data)', () => {
  it('covers a span of seasons', () => {
    expect(YEARS.length).toBeGreaterThanOrEqual(10);
    expect(YEARS[0]).toBeGreaterThanOrEqual(2005);
    expect(YEARS[YEARS.length - 1]).toBeLessThanOrEqual(2020);
    expect([...YEARS].sort((a, b) => a - b)).toEqual(YEARS); // sorted
  });

  it('each season has a sensible set of clubs, each with a full squad', () => {
    for (const y of YEARS) {
      const season = getSeason(y);
      const clubs = Object.keys(season);
      expect(clubs.length, `${y} clubs`).toBeGreaterThanOrEqual(8);
      for (const c of clubs) {
        expect(season[c]!.players.length, `${y} ${c} squad`).toBeGreaterThanOrEqual(11);
        expect(season[c]!.rating).toBeGreaterThan(40);
        expect(season[c]!.rating).toBeLessThan(95);
      }
    }
  });

  it('every player has a valid rating and at least one playable line', () => {
    let total = 0;
    for (const y of YEARS) {
      for (const club of Object.values(getSeason(y))) {
        for (const p of club.players) {
          total++;
          expect(p.r).toBeGreaterThan(30);
          expect(p.r).toBeLessThanOrEqual(99);
          expect(p.l.length).toBeGreaterThan(0);
          for (const l of p.l) expect(LINES).toContain(l);
          expect(p.n.length).toBeGreaterThan(0);
        }
      }
    }
    expect(total).toBeGreaterThan(3000); // real, substantial dataset
  });

  it('the big three are present in recent seasons', () => {
    const season = getSeason(2020);
    expect(season['FC Porto']).toBeTruthy();
    expect(season['Benfica']).toBeTruthy();
    expect(season['Sporting CP']).toBeTruthy();
  });

  it('yearsInRange respects bounds', () => {
    expect(yearsInRange(2008, 2010).every((y) => y >= 2008 && y <= 2010)).toBe(true);
    expect(yearsInRange(2010, 2008)).toEqual(yearsInRange(2008, 2010)); // order-agnostic
  });
});
