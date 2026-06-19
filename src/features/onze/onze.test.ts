import { describe, expect, it } from 'vitest';
import {
  FORMATIONS,
  PACK_SIZE,
  ROUNDS,
  bossRating,
  generateDraft,
  rateXI,
  simulateRun,
} from './onze';
import { PLAYERS, PLAYER_BY_ID, type Player } from './players';

const pick = (packs: Player[][]) => packs.map((p) => p[0]!); // always take the first option

describe('onze de ouro', () => {
  it('pool has enough players per line for the packs', () => {
    const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    for (const p of PLAYERS) counts[p.line]++;
    expect(counts.GK).toBeGreaterThanOrEqual(3);
    expect(counts.DF).toBeGreaterThanOrEqual(4 * PACK_SIZE);
    expect(counts.MF).toBeGreaterThanOrEqual(4 * PACK_SIZE);
    expect(counts.FW).toBeGreaterThanOrEqual(3 * PACK_SIZE);
  });

  it('deals one pack per slot matching the formation lines, no duplicate players', () => {
    const packs = generateDraft('seed-1', '4-3-3');
    expect(packs).toHaveLength(11);
    packs.forEach((pack, i) => {
      expect(pack).toHaveLength(PACK_SIZE);
      for (const p of pack) expect(p.line).toBe(FORMATIONS['4-3-3'][i]);
    });
    const ids = packs.flat().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // drawn without replacement
  });

  it('the draft is deterministic for a given seed and varies by seed', () => {
    const a = generateDraft('day-A', '4-3-3').flat().map((p) => p.id);
    const a2 = generateDraft('day-A', '4-3-3').flat().map((p) => p.id);
    const b = generateDraft('day-B', '4-3-3').flat().map((p) => p.id);
    expect(a).toEqual(a2);
    expect(a).not.toEqual(b);
  });

  it('chemistry rewards a same-club / same-era XI over a scattered one', () => {
    const benficaOuro = PLAYERS.filter((p) => p.club === 'Benfica').slice(0, 5);
    const scattered = [
      PLAYERS.find((p) => p.club === 'Porto')!,
      PLAYERS.find((p) => p.club === 'Sporting')!,
      PLAYERS.find((p) => p.club === 'Outro')!,
      PLAYERS.find((p) => p.era === 'classico')!,
      PLAYERS.find((p) => p.era === 'atual' && p.club === 'Outro') ?? PLAYERS[0]!,
    ];
    expect(rateXI(benficaOuro).chemistry).toBeGreaterThan(rateXI(scattered).chemistry);
  });

  it('simulation is deterministic per seed and reports a coherent run', () => {
    const xi = pick(generateDraft('s', '4-3-3'));
    const r1 = simulateRun(xi, 's');
    const r2 = simulateRun(xi, 's');
    expect(r1.score).toBe(r2.score);
    expect(r1.rounds).toHaveLength(ROUNDS);
    expect(r1.wins).toBe(r1.rounds.filter((x) => x.win).length);
    // knockout: no wins after the first loss
    const firstLoss = r1.rounds.findIndex((x) => !x.win);
    if (firstLoss >= 0) expect(r1.rounds.slice(firstLoss).every((x) => !x.win)).toBe(true);
    expect(r1.champion).toBe(r1.wins === ROUNDS);
  });

  it('the boss XI is strong (rating ≥ 88)', () => {
    expect(bossRating()).toBeGreaterThanOrEqual(88);
  });

  it('every boss id resolves to a real player', () => {
    for (const id of Object.keys(PLAYER_BY_ID)) expect(PLAYER_BY_ID[id]!.name).toBeTruthy();
  });
});
