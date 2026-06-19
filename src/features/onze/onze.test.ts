import { describe, expect, it } from 'vitest';
import {
  FORMATIONS,
  ROUNDS,
  YOUR_TEAM,
  type GamePlayer,
  generateDraft,
  pickSeason,
  posEligible,
  rateXI,
  simulateSeason,
  simulateSete,
  standingsAfter,
  yourMatch,
} from './onze';
import { MAX_YEAR, MIN_YEAR } from './onzeData';

const YEAR = Math.min(2019, MAX_YEAR);
const eligibleFor = (pos: import('./onze').Position, roster: GamePlayer[]) =>
  roster.find((p) => posEligible(pos, p)) ?? roster[0]!;
const firstPicks = (seed: string): GamePlayer[] =>
  generateDraft(seed, '4-3-3', YEAR).map((s) => eligibleFor(s.position, s.roster));

describe('onze de ouro — positions + real-data game', () => {
  it('every formation lists 11 specific positions', () => {
    for (const f of Object.keys(FORMATIONS) as (keyof typeof FORMATIONS)[]) {
      expect(FORMATIONS[f]).toHaveLength(11);
    }
  });

  it('positions stick: an RB cannot fill an LB slot, GK only fills GK', () => {
    const rb: GamePlayer = { id: 'x', name: 'RB', rating: 80, club: 'c', positions: ['RB'], lines: ['DF'], pos: 'RB', photo: null, nat: null };
    const gk: GamePlayer = { id: 'g', name: 'GK', rating: 80, club: 'c', positions: ['GK'], lines: ['GK'], pos: 'GK', photo: null, nat: null };
    expect(posEligible('RB', rb)).toBe(true);
    expect(posEligible('RWB', rb)).toBe(true); // versatile, but…
    expect(posEligible('LB', rb)).toBe(false); // …left stays left
    expect(posEligible('GK', gk)).toBe(true);
    expect(posEligible('ST', gk)).toBe(false);
  });

  it('each draft slot offers a full squad with at least one eligible player, deterministic by seed', () => {
    const d1 = generateDraft('s', '4-3-3', YEAR);
    const d2 = generateDraft('s', '4-3-3', YEAR);
    expect(d1).toHaveLength(11);
    for (const slot of d1) {
      expect(slot.roster.length).toBeGreaterThanOrEqual(11);
      expect(slot.roster.some((p) => posEligible(slot.position, p))).toBe(true);
    }
    expect(d1.map((s) => s.club)).toEqual(d2.map((s) => s.club));
    // one club per slot (distinct where possible)
    expect(new Set(d1.map((s) => s.club)).size).toBe(d1.length);
  });

  it('rates the XI with chemistry within bounds', () => {
    const r = rateXI(firstPicks('s'));
    expect(r.total).toBeGreaterThan(40);
    expect(r.total).toBeLessThan(100);
    expect(r.chemistry).toBeGreaterThanOrEqual(0);
    expect(r.chemistry).toBeLessThanOrEqual(10);
  });

  it('pickSeason stays within range', () => {
    for (let i = 0; i < 20; i++) {
      const y = pickSeason(MIN_YEAR, MAX_YEAR, `s${i}`);
      expect(y).toBeGreaterThanOrEqual(MIN_YEAR);
      expect(y).toBeLessThanOrEqual(MAX_YEAR);
    }
  });

  it('7-game run is deterministic and respects knockout rules', () => {
    const xi = firstPicks('s');
    const a = simulateSete(xi, YEAR, 's');
    expect(a).toEqual(simulateSete(xi, YEAR, 's'));
    expect(a.rounds).toHaveLength(ROUNDS);
    expect(a.rounds[ROUNDS - 1]!.boss).toBe(true);
    const firstLoss = a.rounds.findIndex((r) => !r.win);
    if (firstLoss >= 0) expect(a.rounds.slice(firstLoss).every((r) => !r.win)).toBe(true);
  });

  it('season is a complete double round-robin including your XI', () => {
    const res = simulateSeason(firstPicks('s'), YEAR, 's');
    const T = res.teams.length;
    expect(res.teams.some((t) => t.team === YOUR_TEAM)).toBe(true);
    const full = standingsAfter(res, res.jornadas.length);
    expect(full).toHaveLength(T);
    for (const row of full) expect(row.P).toBe(2 * (T - 1));
    for (let i = 1; i < full.length; i++) expect(full[i - 1]!.PTS).toBeGreaterThanOrEqual(full[i]!.PTS);
    let mine = 0;
    for (let j = 0; j < res.jornadas.length; j++) if (yourMatch(res, j)) mine++;
    expect(mine).toBe(2 * (T - 1));
  });
});
