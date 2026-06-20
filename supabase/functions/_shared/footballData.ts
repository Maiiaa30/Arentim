// Football-Data.org (v4) integration for Arentim.
//
// Free tier: structured fixtures/scores/standings for the major competitions
// (incl. Liga Portugal). No odds on the free plan — so we GENERATE realistic
// odds from real team form: a Poisson model fed by each side's goals
// for/against per game (from the live league standings), with a home-advantage
// factor and a bookmaker margin. Free, ToS-friendly, and feels real.
//
// Token lives only in this function's secrets (FOOTBALL_DATA_TOKEN); fetches are
// locked to the single allowlisted host (SSRF-safe).

const FD_BASE = 'https://api.football-data.org/v4';

/** Competitions to sync (free-tier codes). Liga Portugal first, then the big leagues + UCL. */
export const FD_COMPETITIONS: { code: string; name: string }[] = [
  { code: 'WC', name: 'Campeonato do Mundo' }, // live in summer tournament years
  { code: 'PPL', name: 'Liga Portugal' },
  { code: 'CL', name: 'Liga dos Campeões' },
  { code: 'PL', name: 'Premier League' },
  { code: 'PD', name: 'La Liga' },
  { code: 'SA', name: 'Serie A' },
  { code: 'BL1', name: 'Bundesliga' },
];

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fdGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(FD_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { 'X-Auth-Token': token } });
  if (res.status === 429) throw new Error('football-data rate limit (429)');
  if (!res.ok) throw new Error(`football-data ${res.status} on ${path}`);
  return (await res.json()) as T;
}

type FdTeam = { name: string; shortName?: string; crest?: string };

export type FdMatch = {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score?: { fullTime?: { home: number | null; away: number | null } };
  season?: { startDate?: string };
};

export const teamName = (t: FdTeam) => t.shortName || t.name;
export const teamCrest = (t: FdTeam): string | null => t.crest ?? null;

/** Map a Football-Data status onto our fixtures.status check constraint. */
export function mapStatus(s: string): 'scheduled' | 'live' | 'finished' | 'postponed' {
  switch (s) {
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'FINISHED':
    case 'AWARDED':
      return 'finished';
    case 'POSTPONED':
    case 'SUSPENDED':
    case 'CANCELLED':
      return 'postponed';
    default:
      return 'scheduled'; // SCHEDULED, TIMED
  }
}

export const score = (m: FdMatch) => ({
  home: m.score?.fullTime?.home ?? null,
  away: m.score?.fullTime?.away ?? null,
});

export const seasonYear = (m: FdMatch): number | null => {
  const y = m.season?.startDate?.slice(0, 4);
  return y ? Number(y) : null;
};

// ---- Standings → team strength + public stats snapshot ---------------------
type TeamForm = { atk: number; def: number; played: number };

/** Public per-team standings snapshot stored on the fixture (for the popup). */
export type TeamStat = {
  position: number | null;
  played: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  gf: number;
  ga: number;
  form: string | null;
};

export type Strength = { avg: number; teams: Map<string, TeamForm>; stand: Map<string, TeamStat> };

/** Build attack/defence multipliers + a stats snapshot per team from the standings. */
export async function fetchStrength(code: string, token: string): Promise<Strength> {
  type Row = {
    team: { name: string; shortName?: string };
    position?: number;
    playedGames: number;
    won?: number;
    draw?: number;
    lost?: number;
    points?: number;
    goalsFor: number;
    goalsAgainst: number;
    form?: string | null;
  };
  type Resp = { standings: { type: string; table: Row[] }[] };
  const data = await fdGet<Resp>(`/competitions/${code}/standings`, token);
  // Leagues have one TOTAL table; group tournaments (World Cup, UCL groups) have
  // several — merge them all so every team is covered.
  const total = (data.standings ?? []).filter((s) => s.type === 'TOTAL').flatMap((s) => s.table);
  let sumGF = 0, sumPlayed = 0;
  for (const r of total) { sumGF += r.goalsFor ?? 0; sumPlayed += r.playedGames ?? 0; }
  const avg = sumPlayed > 0 ? sumGF / sumPlayed : 1.35; // goals/team/game
  const teams = new Map<string, TeamForm>();
  const stand = new Map<string, TeamStat>();
  for (const r of total) {
    const p = r.playedGames ?? 0;
    if (p <= 0) continue;
    const form: TeamForm = { atk: r.goalsFor / p / avg, def: r.goalsAgainst / p / avg, played: p };
    const stat: TeamStat = {
      position: r.position ?? null,
      played: p,
      won: r.won ?? 0,
      draw: r.draw ?? 0,
      lost: r.lost ?? 0,
      points: r.points ?? 0,
      gf: r.goalsFor ?? 0,
      ga: r.goalsAgainst ?? 0,
      form: r.form ?? null,
    };
    // Index under every name variant so the match's team (which may use shortName)
    // is found regardless of which the standings used.
    for (const key of [teamName(r.team), r.team.name, r.team.shortName]) {
      if (key) { teams.set(key, form); stand.set(key, stat); }
    }
  }
  return { avg, teams, stand };
}

export async function fetchMatches(code: string, token: string, from: string, to: string): Promise<FdMatch[]> {
  type Resp = { matches: FdMatch[] };
  const data = await fdGet<Resp>(`/competitions/${code}/matches`, token, { dateFrom: from, dateTo: to });
  return data.matches ?? [];
}

/** Today's matches across all the token's competitions (one call) — for live polling. */
export async function fetchMatchesByDate(token: string, from: string, to: string): Promise<FdMatch[]> {
  type Resp = { matches: FdMatch[] };
  const data = await fdGet<Resp>('/matches', token, { dateFrom: from, dateTo: to });
  return data.matches ?? [];
}

/** A single match by id — used to reconcile a fixture stuck 'live' outside the
 *  polling window (e.g. a game that finished while the cron wasn't running). */
export async function fetchMatchById(token: string, id: number): Promise<FdMatch | null> {
  try {
    return await fdGet<FdMatch>(`/matches/${id}`, token);
  } catch {
    return null;
  }
}

// ---- Odds model (Poisson) --------------------------------------------------
const HOME_ADV = 1.15;
const MARGIN = 0.07; // ~7% overround
const MAXG = 8;

const MIN_ODD = 1.08;
const MAX_ODD = 8.0; // cap longshots so we never show "crazy" 11+ prices

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
const pois = (k: number, l: number) => (Math.exp(-l) * Math.pow(l, k)) / factorial(k);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const toOdd = (p: number) => clamp(Math.round((1 / (Math.max(p, 0.02) * (1 + MARGIN))) * 100) / 100, MIN_ODD, MAX_ODD);

const NEUTRAL = {
  '1x2': { home: 2.50, draw: 3.20, away: 2.70 },
  ou25: { over: 1.90, under: 1.90 },
  btts: { yes: 1.90, no: 1.90 },
};

const AVG_FORM: TeamForm = { atk: 1, def: 1, played: 0 };

/** Realistic odds for a fixture from team form. Uses whatever form is known;
 *  an unknown team defaults to league-average, so odds still vary by opponent +
 *  home advantage. Fully neutral only when neither team is in the standings. */
export function computeOdds(home: string, away: string, s: Strength): Record<string, Record<string, number>> {
  const dh = s.teams.get(home);
  const da = s.teams.get(away);
  if (!dh && !da) return NEUTRAL;
  const h = dh ?? AVG_FORM;
  const a = da ?? AVG_FORM;

  // Tighter clamps keep prices in a sane casino range (no extreme skew).
  const expH = clamp(s.avg * h.atk * a.def * HOME_ADV, 0.4, 3.0);
  const expA = clamp((s.avg * a.atk * h.def) / HOME_ADV, 0.35, 2.6);

  const ph: number[] = [], pa: number[] = [];
  for (let k = 0; k <= MAXG; k++) { ph[k] = pois(k, expH); pa[k] = pois(k, expA); }

  let pHome = 0, pDraw = 0, pAway = 0, over = 0, btts = 0;
  for (let i = 0; i <= MAXG; i++) {
    for (let j = 0; j <= MAXG; j++) {
      const p = ph[i]! * pa[j]!;
      if (i > j) pHome += p; else if (i === j) pDraw += p; else pAway += p;
      if (i + j >= 3) over += p;
      if (i >= 1 && j >= 1) btts += p;
    }
  }
  const tot = pHome + pDraw + pAway || 1;
  pHome /= tot; pDraw /= tot; pAway /= tot;

  return {
    '1x2': { home: toOdd(pHome), draw: toOdd(pDraw), away: toOdd(pAway) },
    ou25: { over: toOdd(over), under: toOdd(1 - over) },
    btts: { yes: toOdd(btts), no: toOdd(1 - btts) },
  };
}
