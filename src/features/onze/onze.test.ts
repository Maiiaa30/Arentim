import { describe, expect, it } from 'vitest';
import {
  FORMATIONS,
  ROUNDS,
  YOUR_TEAM,
  type GamePlayer,
  buildOffers,
  latestIn,
  posEligible,
  rateXI,
  rosterOf,
  simulateSeason,
  simulateSete,
  standingsAfter,
} from './onze';
import { MAX_YEAR, MIN_YEAR } from './onzeData';

/** Build a valid XI greedily by drawing offers and placing eligible players. */
function buildXI(seed: string): GamePlayer[] {
  const offers = buildOffers(seed, MIN_YEAR, MAX_YEAR);
  const slots = FORMATIONS['4-3-3'];
  const picks: (GamePlayer | null)[] = Array(11).fill(null);
  const used = new Set<string>();
  for (const o of offers) {
    if (picks.every(Boolean)) break;
    if (used.has(o.club)) continue;
    const roster = rosterOf(o);
    for (let i = 0; i < 11; i++) {
      if (picks[i]) continue;
      const cand = roster.find((p) => posEligible(slots[i]!, p));
      if (cand) { picks[i] = cand; used.add(o.club); break; }
    }
  }
  return picks.filter((p): p is GamePlayer => p != null);
}

describe('onze de ouro — offer draft + real data', () => {
  it('every formation lists 11 specific positions', () => {
    for (const f of Object.keys(FORMATIONS) as (keyof typeof FORMATIONS)[]) expect(FORMATIONS[f]).toHaveLength(11);
  });

  it('positions stick: RB ≠ LB, GK only GK', () => {
    const rb: GamePlayer = { id: 'x', name: 'RB', rating: 80, club: 'c', positions: ['RB'], lines: ['DF'], pos: 'RB', photo: null, nat: null };
    const gk: GamePlayer = { id: 'g', name: 'GK', rating: 80, club: 'c', positions: ['GK'], lines: ['GK'], pos: 'GK', photo: null, nat: null };
    expect(posEligible('RB', rb)).toBe(true);
    expect(posEligible('LB', rb)).toBe(false);
    expect(posEligible('GK', gk)).toBe(true);
    expect(posEligible('ST', gk)).toBe(false);
  });

  it('offers are distinct clubs at in-range seasons, deterministic per seed', () => {
    const a = buildOffers('s', MIN_YEAR, MAX_YEAR);
    const b = buildOffers('s', MIN_YEAR, MAX_YEAR);
    expect(a.length).toBeGreaterThanOrEqual(11);
    expect(new Set(a.map((o) => o.club)).size).toBe(a.length); // one per club
    for (const o of a) { expect(o.year).toBeGreaterThanOrEqual(MIN_YEAR); expect(o.year).toBeLessThanOrEqual(MAX_YEAR); }
    expect(a.map((o) => `${o.club}:${o.year}`)).toEqual(b.map((o) => `${o.club}:${o.year}`));
    // narrowing the range changes the deck
    const recent = buildOffers('s', MAX_YEAR, MAX_YEAR);
    expect(recent.every((o) => o.year === MAX_YEAR)).toBe(true);
  });

  it('rosters are non-empty and a full XI is draftable', () => {
    const offers = buildOffers('s', MIN_YEAR, MAX_YEAR);
    expect(rosterOf(offers[0]!).length).toBeGreaterThanOrEqual(11);
    expect(buildXI('s')).toHaveLength(11);
  });

  it('rates the XI with chemistry within bounds', () => {
    const r = rateXI(buildXI('s'));
    expect(r.total).toBeGreaterThan(40);
    expect(r.chemistry).toBeGreaterThanOrEqual(0);
    expect(r.chemistry).toBeLessThanOrEqual(10);
  });

  it('7-game run is deterministic and respects knockout rules', () => {
    const xi = buildXI('s');
    const y = latestIn(MIN_YEAR, MAX_YEAR);
    const a = simulateSete(xi, y, 's');
    expect(a).toEqual(simulateSete(xi, y, 's'));
    expect(a.rounds).toHaveLength(ROUNDS);
    expect(a.rounds[ROUNDS - 1]!.boss).toBe(true);
    const firstLoss = a.rounds.findIndex((r) => !r.win);
    if (firstLoss >= 0) expect(a.rounds.slice(firstLoss).every((r) => !r.win)).toBe(true);
  });

  it('season is a complete double round-robin including your XI', () => {
    const res = simulateSeason(buildXI('s'), latestIn(MIN_YEAR, MAX_YEAR), 's');
    const T = res.teams.length;
    expect(res.teams.some((t) => t.team === YOUR_TEAM)).toBe(true);
    const full = standingsAfter(res, res.jornadas.length);
    expect(full).toHaveLength(T);
    for (const row of full) expect(row.P).toBe(2 * (T - 1));
    for (let i = 1; i < full.length; i++) expect(full[i - 1]!.PTS).toBeGreaterThanOrEqual(full[i]!.PTS);
  });

  it('includes the recent 2026 season', () => {
    expect(MAX_YEAR).toBe(2026);
  });
});
