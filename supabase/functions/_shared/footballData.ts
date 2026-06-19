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

export type FdMatch = {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | null;
  homeTeam: { name: string; shortName?: string };
  awayTeam: { name: string; shortName?: string };
  score?: { fullTime?: { home: number | null; away: number | null } };
  season?: { startDate?: string };
};

export const teamName = (t: { name: string; shortName?: string }) => t.shortName || t.name;

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

// ---- Standings → team strength ---------------------------------------------
type TeamForm = { atk: number; def: number; played: number };
export type Strength = { avg: number; teams: Map<string, TeamForm> };

/** Build attack/defence multipliers per team from a competition's TOTAL table. */
export async function fetchStrength(code: string, token: string): Promise<Strength> {
  type Row = { team: { name: string; shortName?: string }; playedGames: number; goalsFor: number; goalsAgainst: number };
  type Resp = { standings: { type: string; table: Row[] }[] };
  const data = await fdGet<Resp>(`/competitions/${code}/standings`, token);
  const total = data.standings?.find((s) => s.type === 'TOTAL')?.table ?? [];
  let sumGF = 0, sumPlayed = 0;
  for (const r of total) { sumGF += r.goalsFor ?? 0; sumPlayed += r.playedGames ?? 0; }
  const avg = sumPlayed > 0 ? sumGF / sumPlayed : 1.35; // goals/team/game
  const teams = new Map<string, TeamForm>();
  for (const r of total) {
    const p = r.playedGames ?? 0;
    if (p <= 0) continue;
    teams.set(teamName(r.team), {
      atk: r.goalsFor / p / avg,
      def: r.goalsAgainst / p / avg,
      played: p,
    });
  }
  return { avg, teams };
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

// ---- Odds model (Poisson) --------------------------------------------------
const HOME_ADV = 1.15;
const MARGIN = 0.07; // ~7% overround
const MAXG = 8;

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
const pois = (k: number, l: number) => (Math.exp(-l) * Math.pow(l, k)) / factorial(k);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const toOdd = (p: number) => Math.max(1.05, Math.round((1 / (Math.max(p, 0.02) * (1 + MARGIN))) * 100) / 100);

const NEUTRAL = {
  '1x2': { home: 2.50, draw: 3.20, away: 2.70 },
  ou25: { over: 1.90, under: 1.90 },
  btts: { yes: 1.90, no: 1.90 },
};

/** Realistic odds for a fixture from team form; neutral fallback if unknown. */
export function computeOdds(home: string, away: string, s: Strength): Record<string, Record<string, number>> {
  const h = s.teams.get(home);
  const a = s.teams.get(away);
  if (!h || !a || h.played < 2 || a.played < 2) return NEUTRAL;

  const expH = clamp(s.avg * h.atk * a.def * HOME_ADV, 0.25, 4.2);
  const expA = clamp((s.avg * a.atk * h.def) / HOME_ADV, 0.2, 3.8);

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
