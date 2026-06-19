/**
 * Onze de Ouro — pure game logic (no React, fully unit-testable).
 *
 * Loop: pick a formation → for each slot you're dealt a seeded pack of players of
 * that line → draft one → the XI is rated (quality + chemistry: same-club /
 * same-era links) → a 7-round knockout is simulated against ramping opponents,
 * the last being the legendary boss XI. Going 7-0 wins the title.
 *
 * The daily challenge uses a date-derived seed so everyone gets the same packs +
 * the same simulation draws → fair, comparable scores.
 */
import { BOSS_XI, PLAYERS, PLAYER_BY_ID, type Line, type Player } from './players';

export type Formation = '4-3-3' | '4-4-2' | '3-4-3';

export const FORMATIONS: Record<Formation, Line[]> = {
  '4-3-3': ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'],
  '4-4-2': ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW'],
  '3-4-3': ['GK', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'],
};

export const PACK_SIZE = 3;
export const ROUNDS = 7; // a 7-0 title run

// ---- Seeded RNG (mulberry32) ----------------------------------------------
export function hashSeed(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's seed string for the daily challenge (local date). */
export function dailySeed(d = new Date()): string {
  return `onze-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Deterministically deal one pack per slot, drawing without replacement so no
 * player can appear in two packs (and thus never duplicated in the XI).
 */
export function generateDraft(seed: string, formation: Formation): Player[][] {
  const rand = rng(hashSeed(seed));
  const byLine: Record<Line, Player[]> = { GK: [], DF: [], MF: [], FW: [] };
  for (const line of ['GK', 'DF', 'MF', 'FW'] as Line[]) {
    byLine[line] = shuffle(PLAYERS.filter((p) => p.line === line), rand);
  }
  const cursor: Record<Line, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
  return FORMATIONS[formation].map((line) => {
    const pool = byLine[line];
    const pack = pool.slice(cursor[line], cursor[line] + PACK_SIZE);
    cursor[line] += PACK_SIZE;
    return pack;
  });
}

export interface Rating {
  base: number; // average player quality
  chemistry: number; // bonus from links
  total: number;
}

/** Rate an XI: average quality + chemistry (same-club / same-era pairs), capped. */
export function rateXI(xi: Player[]): Rating {
  if (xi.length === 0) return { base: 0, chemistry: 0, total: 0 };
  const base = xi.reduce((s, p) => s + p.rating, 0) / xi.length;
  let chem = 0;
  for (let i = 0; i < xi.length; i++) {
    for (let j = i + 1; j < xi.length; j++) {
      if (xi[i]!.club === xi[j]!.club && xi[i]!.club !== 'Outro') chem += 0.45;
      if (xi[i]!.era === xi[j]!.era) chem += 0.3;
    }
  }
  chem = Math.min(12, Math.round(chem * 10) / 10);
  return { base: Math.round(base * 10) / 10, chemistry: chem, total: Math.round(base + chem) };
}

/** The boss XI's rating (the final opponent). */
export function bossRating(): number {
  return rateXI(BOSS_XI.map((id) => PLAYER_BY_ID[id]!)).total;
}

export interface RoundResult {
  round: number;
  opponent: number; // opponent rating
  win: boolean;
  boss: boolean;
}
export interface RunResult {
  rating: Rating;
  rounds: RoundResult[];
  wins: number;
  champion: boolean;
  score: number;
  record: string;
}

/** Simulate the 7-round knockout. Opponents ramp from ~72 up to the boss. */
export function simulateRun(xi: Player[], seed: string): RunResult {
  const rating = rateXI(xi);
  const rand = rng(hashSeed(seed + '-sim'));
  const boss = bossRating();
  const rounds: RoundResult[] = [];
  let wins = 0;
  let alive = true;

  for (let r = 1; r <= ROUNDS; r++) {
    const isBoss = r === ROUNDS;
    const opp = isBoss ? boss : Math.round(72 + ((boss - 72) * (r - 1)) / (ROUNDS - 1));
    let win = false;
    if (alive) {
      const p = 1 / (1 + Math.pow(10, (opp - rating.total) / 16));
      win = rand() < p;
      if (win) wins += 1;
      else alive = false;
    }
    rounds.push({ round: r, opponent: opp, win, boss: isBoss });
  }

  const champion = wins === ROUNDS;
  const score = wins * 1000 + Math.round(rating.total) + (champion ? 750 : 0);
  const record = champion ? '7–0 · Campeão' : `${wins} ${wins === 1 ? 'vitória' : 'vitórias'}`;
  return { rating, rounds, wins, champion, score, record };
}
