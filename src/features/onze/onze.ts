/**
 * Onze de Ouro — pure game logic over the real Liga Portugal dataset.
 *
 * Two modes:
 *  - 'sete'  (7-game): a 7-round knockout vs that season's clubs, ending on the
 *            strongest club. Beat all seven → 7-0.
 *  - 'epoca' (season): your XI joins that season's league; a full double
 *            round-robin (2·(N-1) jornadas) is simulated with scorers + a live
 *            table. Score = league points; finishing top is the dream.
 *
 * Draft: each slot is assigned a random club; you pick one of that club's players
 * who can play the slot's line. A seed (the day, or random for practice) makes
 * the draw + simulation deterministic and shareable.
 */
import { type Line, type RawPlayer, type Season, clubNames, getSeason, yearsInRange } from './onzeData';

export type Mode = 'sete' | 'epoca';
export type Formation = '4-3-3' | '4-4-2' | '3-4-3';

export const FORMATIONS: Record<Formation, Line[]> = {
  '4-3-3': ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'],
  '4-4-2': ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW'],
  '3-4-3': ['GK', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'],
};

export const ROUNDS = 7;
export const YOUR_TEAM = 'O teu XI';

export interface GamePlayer {
  id: string;
  name: string;
  rating: number;
  club: string;
  lines: Line[];
  pos: string;
  photo: string | null;
  nat: string | null;
}

// ---- Seeded RNG ------------------------------------------------------------
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
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const dailySeed = (d = new Date()) => `onze-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const randInt = (rand: () => number, n: number) => Math.floor(rand() * n);
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rand, i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const toGame = (club: string, p: RawPlayer): GamePlayer => ({
  id: `${club}:${p.n}`,
  name: p.n,
  rating: p.r,
  club,
  lines: p.l,
  pos: p.p,
  photo: p.ph,
  nat: p.nat,
});

/** Pick a season within the chosen year range (random per seed). */
export function pickSeason(startYear: number, endYear: number, seed: string): number {
  const years = yearsInRange(startYear, endYear);
  const rand = rng(hashSeed(seed + '-year'));
  return years[randInt(rand, years.length)] ?? years[0]!;
}

export interface DraftSlot {
  line: Line;
  club: string;
  pack: GamePlayer[]; // that club's players who can fill the line, best first
}

/** One random club per slot (distinct where possible); pack = its players for the line. */
export function generateDraft(seed: string, formation: Formation, year: number): DraftSlot[] {
  const season: Season = getSeason(year);
  const clubs = clubNames(year);
  const rand = rng(hashSeed(seed + '-draft'));
  const used = new Set<string>();

  const clubsWithLine = (line: Line) =>
    clubs.filter((c) => season[c]!.players.some((p) => p.l.includes(line)));

  return FORMATIONS[formation].map((line) => {
    const eligible = clubsWithLine(line);
    const fresh = eligible.filter((c) => !used.has(c));
    const pool = fresh.length > 0 ? fresh : eligible;
    const club = pool[randInt(rand, pool.length)]!;
    used.add(club);
    const pack = season[club]!.players
      .filter((p) => p.l.includes(line))
      .sort((a, b) => b.r - a.r)
      .map((p) => toGame(club, p));
    return { line, club, pack };
  });
}

export interface Rating {
  base: number;
  chemistry: number;
  total: number;
}
export function rateXI(xi: GamePlayer[]): Rating {
  if (xi.length === 0) return { base: 0, chemistry: 0, total: 0 };
  const base = xi.reduce((s, p) => s + p.rating, 0) / xi.length;
  let chem = 0;
  for (let i = 0; i < xi.length; i++) {
    for (let j = i + 1; j < xi.length; j++) {
      if (xi[i]!.club === xi[j]!.club) chem += 0.5;
      if (xi[i]!.nat && xi[i]!.nat === xi[j]!.nat) chem += 0.15;
    }
  }
  chem = Math.min(10, Math.round(chem * 10) / 10);
  return { base: Math.round(base * 10) / 10, chemistry: chem, total: Math.round(base + chem) };
}

// ---- 7-game knockout -------------------------------------------------------
export interface RoundResult { round: number; opponent: string; opponentRating: number; win: boolean; boss: boolean; }
export interface SeteResult { kind: 'sete'; rating: Rating; rounds: RoundResult[]; wins: number; champion: boolean; score: number; record: string; }

export function simulateSete(xi: GamePlayer[], year: number, seed: string): SeteResult {
  const rating = rateXI(xi);
  const season = getSeason(year);
  const ranked = clubNames(year)
    .map((c) => ({ club: c, r: season[c]!.rating }))
    .sort((a, b) => a.r - b.r);
  // 7 opponents of rising strength, ending on the strongest club.
  const picks: { club: string; r: number }[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const idx = Math.round((i / (ROUNDS - 1)) * (ranked.length - 1));
    picks.push(ranked[Math.min(ranked.length - 1, Math.max(0, idx))]!);
  }
  picks[ROUNDS - 1] = ranked[ranked.length - 1]!; // boss = best club

  const rand = rng(hashSeed(seed + '-sete'));
  const rounds: RoundResult[] = [];
  let wins = 0, alive = true;
  for (let r = 1; r <= ROUNDS; r++) {
    const opp = picks[r - 1]!;
    let win = false;
    if (alive) {
      const p = 1 / (1 + Math.pow(10, (opp.r - rating.total) / 16));
      win = rand() < p;
      if (win) wins += 1; else alive = false;
    }
    rounds.push({ round: r, opponent: opp.club, opponentRating: opp.r, win, boss: r === ROUNDS });
  }
  const champion = wins === ROUNDS;
  return {
    kind: 'sete',
    rating,
    rounds,
    wins,
    champion,
    score: wins * 1000 + Math.round(rating.total) + (champion ? 750 : 0),
    record: champion ? '7–0 · Campeão' : `${wins} ${wins === 1 ? 'vitória' : 'vitórias'}`,
  };
}

// ---- Season (double round-robin) -------------------------------------------
export interface Match { home: string; away: string; hs: number; as: number; scorers: { team: string; name: string; minute: number }[]; }
export interface TableRow { team: string; rating: number; P: number; W: number; D: number; L: number; GF: number; GA: number; GD: number; PTS: number; }
export interface SeasonResult {
  kind: 'epoca';
  rating: Rating;
  year: number;
  teams: { team: string; rating: number }[];
  jornadas: Match[][]; // matches per round
  // Filled as the user steps; helpers below compute standings up to a round.
}

const poisson = (lambda: number, rand: () => number): number => {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L && k < 12);
  return k - 1;
};

/** Circle-method double round-robin schedule. */
function schedule(teams: string[], rand: () => number): [string, string][][] {
  const ts = shuffle(teams, rand);
  if (ts.length % 2 === 1) ts.push('__bye__');
  const n = ts.length;
  const half = n / 2;
  const firstLeg: [string, string][][] = [];
  let order = [...ts];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < half; i++) {
      const a = order[i]!, b = order[n - 1 - i]!;
      if (a !== '__bye__' && b !== '__bye__') round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    firstLeg.push(round);
    order = [order[0]!, ...order.slice(2), order[1]!]; // rotate, fix first
  }
  // Second leg = home/away swapped.
  const secondLeg = firstLeg.map((round) => round.map(([h, a]) => [a, h] as [string, string]));
  return [...firstLeg, ...secondLeg];
}

function rosterFor(team: string, xi: GamePlayer[], season: Season): { name: string; w: number }[] {
  const weight: Record<Line, number> = { FW: 5, MF: 2, DF: 1, GK: 0.1 };
  if (team === YOUR_TEAM) return xi.map((p) => ({ name: p.name, w: weight[p.lines[0] ?? 'MF'] }));
  return (season[team]?.players ?? []).map((p) => ({ name: p.n, w: weight[p.l[0] ?? 'MF'] }));
}

function pickScorer(roster: { name: string; w: number }[], rand: () => number): string {
  const total = roster.reduce((s, r) => s + r.w, 0) || 1;
  let x = rand() * total;
  for (const r of roster) { x -= r.w; if (x <= 0) return r.name; }
  return roster[0]?.name ?? '—';
}

export function simulateSeason(xi: GamePlayer[], year: number, seed: string): SeasonResult {
  const rating = rateXI(xi);
  const season = getSeason(year);
  const teams = clubNames(year).map((c) => ({ team: c, rating: season[c]!.rating }));
  teams.push({ team: YOUR_TEAM, rating: rating.total });
  const ratingOf = new Map(teams.map((t) => [t.team, t.rating]));

  const rand = rng(hashSeed(seed + '-epoca'));
  const fixtures = schedule(teams.map((t) => t.team), rand);

  const jornadas: Match[][] = fixtures.map((round) =>
    round.map(([home, away]) => {
      const rh = ratingOf.get(home)!, ra = ratingOf.get(away)!;
      const lh = Math.min(4, Math.max(0.2, 1.35 * Math.exp((rh - ra) / 26) * 1.12));
      const la = Math.min(4, Math.max(0.2, 1.35 * Math.exp((ra - rh) / 26) / 1.12));
      const hs = poisson(lh, rand), as = poisson(la, rand);
      const hRoster = rosterFor(home, xi, season), aRoster = rosterFor(away, xi, season);
      const scorers = [
        ...Array.from({ length: hs }, () => ({ team: home, name: pickScorer(hRoster, rand), minute: 1 + randInt(rand, 90) })),
        ...Array.from({ length: as }, () => ({ team: away, name: pickScorer(aRoster, rand), minute: 1 + randInt(rand, 90) })),
      ].sort((a, b) => a.minute - b.minute);
      return { home, away, hs, as, scorers };
    }),
  );

  return { kind: 'epoca', rating, year, teams, jornadas };
}

/** Standings after the first `upTo` jornadas (0 = before kickoff). */
export function standingsAfter(res: SeasonResult, upTo: number): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const t of res.teams) rows.set(t.team, { team: t.team, rating: t.rating, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, PTS: 0 });
  for (let j = 0; j < Math.min(upTo, res.jornadas.length); j++) {
    for (const m of res.jornadas[j]!) {
      const h = rows.get(m.home)!, a = rows.get(m.away)!;
      h.P++; a.P++; h.GF += m.hs; h.GA += m.as; a.GF += m.as; a.GA += m.hs;
      h.GD = h.GF - h.GA; a.GD = a.GF - a.GA;
      if (m.hs > m.as) { h.W++; h.PTS += 3; a.L++; }
      else if (m.hs < m.as) { a.W++; a.PTS += 3; h.L++; }
      else { h.D++; a.D++; h.PTS++; a.PTS++; }
    }
  }
  return [...rows.values()].sort((x, y) => y.PTS - x.PTS || y.GD - x.GD || y.GF - x.GF || x.team.localeCompare(y.team));
}

/** Your match in a given jornada (or null on a bye round). */
export const yourMatch = (res: SeasonResult, j: number): Match | null =>
  res.jornadas[j]?.find((m) => m.home === YOUR_TEAM || m.away === YOUR_TEAM) ?? null;
