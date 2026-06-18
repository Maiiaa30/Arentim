/**
 * API-Football client helpers. SSRF-safe: the base URL is a fixed allowlisted
 * host and no user input ever influences the request path (OWASP A01).
 */

export const API_FOOTBALL_HOST = 'https://v3.football.api-sports.io';

/** Leagues we sync. 94 = Primeira Liga, 1 = FIFA World Cup. */
export const SYNCED_LEAGUES = [
  { id: 94, name: 'Primeira Liga' },
  { id: 1, name: 'World Cup' },
] as const;

interface ApiResponse<T> {
  response: T[];
  errors?: unknown;
}

export async function apiFootballGet<T>(
  path: string,
  query: Record<string, string | number>,
  apiKey: string,
): Promise<T[]> {
  const url = new URL(`${API_FOOTBALL_HOST}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), {
    headers: { 'x-apisports-key': apiKey },
  });
  if (!res.ok) {
    throw new Error(`API-Football ${path} returned ${res.status}`);
  }
  const json = (await res.json()) as ApiResponse<T>;
  return json.response ?? [];
}

// ---- Parsing helpers (defensive: the upstream shape can vary) --------------

export interface ParsedFixture {
  external_ref: string;
  league: string;
  season: number | null;
  home: string;
  away: string;
  kickoff: string;
  status: 'scheduled' | 'live' | 'finished';
}

interface RawFixture {
  fixture?: { id?: number; date?: string; status?: { short?: string } };
  league?: { name?: string; season?: number };
  teams?: { home?: { name?: string }; away?: { name?: string } };
}

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE']);
const DONE_STATUSES = new Set(['FT', 'AET', 'PEN']);

function mapStatus(short?: string): 'scheduled' | 'live' | 'finished' {
  if (short && DONE_STATUSES.has(short)) return 'finished';
  if (short && LIVE_STATUSES.has(short)) return 'live';
  return 'scheduled';
}

export function parseFixtures(raw: RawFixture[], leagueName: string): ParsedFixture[] {
  const out: ParsedFixture[] = [];
  for (const r of raw) {
    const id = r.fixture?.id;
    const home = r.teams?.home?.name;
    const away = r.teams?.away?.name;
    const date = r.fixture?.date;
    if (id == null || !home || !away || !date) continue;
    out.push({
      external_ref: String(id),
      league: r.league?.name ?? leagueName,
      season: r.league?.season ?? null,
      home,
      away,
      kickoff: date,
      status: mapStatus(r.fixture?.status?.short),
    });
  }
  return out;
}

export interface ParsedOdds {
  external_ref: string;
  odds: Record<string, Record<string, number>>;
}

interface RawOdds {
  fixture?: { id?: number };
  bookmakers?: { bets?: { name?: string; values?: { value?: string; odd?: string }[] }[] }[];
}

const num = (s?: string): number | null => {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 1 ? n : null;
};

/** Extract 1X2, Over/Under 2.5 and BTTS from the first bookmaker that has them. */
export function parseOdds(raw: RawOdds[]): ParsedOdds[] {
  const out: ParsedOdds[] = [];
  for (const r of raw) {
    const id = r.fixture?.id;
    if (id == null) continue;
    const bets = r.bookmakers?.[0]?.bets ?? [];
    const odds: Record<string, Record<string, number>> = {};

    const find = (name: string) => bets.find((b) => b.name === name)?.values ?? [];
    const get = (vals: { value?: string; odd?: string }[], v: string) =>
      num(vals.find((x) => x.value === v)?.odd);

    const mw = find('Match Winner');
    const h = get(mw, 'Home');
    const d = get(mw, 'Draw');
    const a = get(mw, 'Away');
    if (h && d && a) odds['1x2'] = { home: h, draw: d, away: a };

    const ou = find('Goals Over/Under');
    const over = get(ou, 'Over 2.5');
    const under = get(ou, 'Under 2.5');
    if (over && under) odds['ou25'] = { over, under };

    const btts = find('Both Teams Score');
    const yes = get(btts, 'Yes');
    const no = get(btts, 'No');
    if (yes && no) odds['btts'] = { yes, no };

    if (Object.keys(odds).length > 0) out.push({ external_ref: String(id), odds });
  }
  return out;
}
