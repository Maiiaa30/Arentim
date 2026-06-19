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

/**
 * The season API-Football expects for the *current* campaign. European seasons
 * span two calendar years and are keyed by the starting year — so e.g. the
 * 2025/26 season is `2025`. Before August we're still in the campaign that
 * started the previous year. `FOOTBALL_SEASON` overrides this when set (e.g. to
 * pin to a season the active subscription covers).
 *
 * NOTE: the free API-Football plan only serves old seasons (2021–2023). Calling
 * this with the real current season requires a paid plan; until then the request
 * returns an empty `response` and we simply sync nothing new.
 */
export function currentSeason(now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  // Months are 0-indexed: 7 === August. Seasons roll over at the start of August.
  return now.getUTCMonth() >= 7 ? year : year - 1;
}

/** Resolve the season to sync: explicit env override, else the current season. */
export function resolveSeason(envValue?: string | null, now: Date = new Date()): number {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 1900 ? parsed : currentSeason(now);
}

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

export interface LiveEvent {
  minute: number | null;
  type: string;
  team: string | null;
  player: string | null;
}

export interface ParsedLiveFixture {
  external_ref: string;
  status: 'scheduled' | 'live' | 'finished';
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  events: LiveEvent[];
}

interface RawLiveFixture {
  fixture?: { id?: number; status?: { short?: string; elapsed?: number } };
  goals?: { home?: number | null; away?: number | null };
  events?: { time?: { elapsed?: number }; type?: string; team?: { name?: string }; player?: { name?: string } }[];
}

/** Parse the live-fixtures feed into score/minute/event updates. */
export function parseLive(raw: RawLiveFixture[]): ParsedLiveFixture[] {
  const out: ParsedLiveFixture[] = [];
  for (const r of raw) {
    const id = r.fixture?.id;
    if (id == null) continue;
    out.push({
      external_ref: String(id),
      status: mapStatus(r.fixture?.status?.short),
      minute: r.fixture?.status?.elapsed ?? null,
      home_score: r.goals?.home ?? null,
      away_score: r.goals?.away ?? null,
      events: (r.events ?? []).map((e) => ({
        minute: e.time?.elapsed ?? null,
        type: e.type ?? 'event',
        team: e.team?.name ?? null,
        player: e.player?.name ?? null,
      })),
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
