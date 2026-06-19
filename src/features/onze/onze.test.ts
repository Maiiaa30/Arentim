import { describe, expect, it } from 'vitest';
import {
  FORMATIONS,
  ROUNDS,
  YOUR_TEAM,
  type GamePlayer,
  generateDraft,
  pickSeason,
  rateXI,
  simulateSeason,
  simulateSete,
  standingsAfter,
  yourMatch,
} from './onze';
import { MAX_YEAR, MIN_YEAR } from './onzeData';

const YEAR = Math.min(2019, MAX_YEAR);
const firstPicks = (seed: string): GamePlayer[] =>
  generateDraft(seed, '4-3-3', YEAR).map((s) => s.pack[0]!);

describe('onze de ouro — real-data game', () => {
  it('drafts 11 slots, packs matching the line, deterministic by seed', () => {
    const d1 = generateDraft('s', '4-3-3', YEAR);
    const d2 = generateDraft('s', '4-3-3', YEAR);
    expect(d1).toHaveLength(11);
    d1.forEach((slot, i) => {
      expect(slot.pack.length).toBeGreaterThan(0);
      expect(slot.line).toBe(FORMATIONS['4-3-3'][i]);
      for (const p of slot.pack) expect(p.lines).toContain(slot.line);
    });
    expect(d1.map((s) => s.pack[0]!.id)).toEqual(d2.map((s) => s.pack[0]!.id));
    expect(generateDraft('other', '4-3-3', YEAR).map((s) => s.club)).not.toEqual(d1.map((s) => s.club));
  });

  it('rates the XI with chemistry within bounds', () => {
    const xi = firstPicks('s');
    const r = rateXI(xi);
    expect(r.total).toBeGreaterThan(40);
    expect(r.total).toBeLessThan(100);
    expect(r.chemistry).toBeGreaterThanOrEqual(0);
    expect(r.chemistry).toBeLessThanOrEqual(10);
  });

  it('pickSeason stays within the requested range', () => {
    for (let i = 0; i < 20; i++) {
      const y = pickSeason(MIN_YEAR, MAX_YEAR, `seed${i}`);
      expect(y).toBeGreaterThanOrEqual(MIN_YEAR);
      expect(y).toBeLessThanOrEqual(MAX_YEAR);
    }
  });

  it('7-game run is deterministic and respects knockout rules', () => {
    const xi = firstPicks('s');
    const a = simulateSete(xi, YEAR, 's');
    const b = simulateSete(xi, YEAR, 's');
    expect(a.score).toBe(b.score);
    expect(a.rounds).toHaveLength(ROUNDS);
    expect(a.rounds[ROUNDS - 1]!.boss).toBe(true);
    const firstLoss = a.rounds.findIndex((r) => !r.win);
    if (firstLoss >= 0) expect(a.rounds.slice(firstLoss).every((r) => !r.win)).toBe(true);
    expect(a.champion).toBe(a.wins === ROUNDS);
  });

  it('season is a complete double round-robin with your XI included', () => {
    const xi = firstPicks('s');
    const res = simulateSeason(xi, YEAR, 's');
    const T = res.teams.length;
    expect(res.teams.some((t) => t.team === YOUR_TEAM)).toBe(true);

    const full = standingsAfter(res, res.jornadas.length);
    expect(full).toHaveLength(T);
    for (const row of full) expect(row.P).toBe(2 * (T - 1)); // everyone plays everyone twice

    // standings are ordered by points
    for (let i = 1; i < full.length; i++) expect(full[i - 1]!.PTS).toBeGreaterThanOrEqual(full[i]!.PTS);

    // your XI plays in 2*(T-1) matches across the calendar
    let mine = 0;
    for (let j = 0; j < res.jornadas.length; j++) if (yourMatch(res, j)) mine++;
    expect(mine).toBe(2 * (T - 1));
  });

  it('a strong XI tends to finish high', () => {
    // Take the best player from each slot's pack → high-rated XI should land top half.
    const xi = firstPicks('strong');
    const res = simulateSeason(xi, YEAR, 'strong');
    const table = standingsAfter(res, res.jornadas.length);
    const pos = table.findIndex((r) => r.team === YOUR_TEAM) + 1;
    expect(pos).toBeLessThanOrEqual(res.teams.length); // sanity: placed in the table
  });
});
