// The Odds API (the-odds-api.com) — REAL bookmaker odds, free tier (500 req/mo).
//
// Football-Data has no odds, so we overlay genuine decimal odds from real
// bookmakers here, matched to our fixtures by normalised team names. Markets:
// h2h (1X2) and totals 2.5 (over/under). No cap — these are the market's actual
// prices. BTTS isn't offered, so it stays on the generated model.
//
// Key in this function's secrets only (ODDS_API_KEY); fetches locked to the host.

const ODDS_BASE = 'https://api.the-odds-api.com/v4';

/** Football-Data competition code → The Odds API sport key. */
export const ODDS_SPORT: Record<string, string> = {
  WC: 'soccer_fifa_world_cup',
  PPL: 'soccer_portugal_primeira_liga',
  CL: 'soccer_uefa_champs_league',
  PL: 'soccer_epl',
  PD: 'soccer_spain_la_liga',
  SA: 'soccer_italy_serie_a',
  BL1: 'soccer_germany_bundesliga',
};

const ALIASES: Record<string, string> = {
  unitedstates: 'usa',
  southkorea: 'korearepublic',
  korearepublic: 'southkorea',
  irran: 'iran',
};

/** Normalise a team/country name for cross-provider matching. */
export function norm(name: string): string {
  let s = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(fc|cf|sc|ac|afc|sad|cd|ud|club|futebol|fk|if|bk)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  s = ALIASES[s] ?? s;
  return s;
}

/** Key for matching a fixture to an odds event. */
export const oddsKey = (home: string, away: string) => `${norm(home)}|${norm(away)}`;

type Outcome = { name: string; price: number; point?: number };
type Market = { key: string; outcomes: Outcome[] };
type Bookmaker = { markets: Market[] };
type OddsEvent = { home_team: string; away_team: string; bookmakers: Bookmaker[] };

export type RealOdds = Record<string, Record<string, number>>;

/** Fetch real odds for a sport → map of oddsKey → { '1x2', 'ou25' }. */
export async function fetchRealOdds(sportKey: string, apiKey: string): Promise<Map<string, RealOdds>> {
  const url = new URL(`${ODDS_BASE}/sports/${sportKey}/odds`);
  url.searchParams.set('regions', 'eu');
  url.searchParams.set('markets', 'h2h,totals');
  url.searchParams.set('oddsFormat', 'decimal');
  url.searchParams.set('apiKey', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`odds-api ${res.status} on ${sportKey}`);
  const events = (await res.json()) as OddsEvent[];

  const map = new Map<string, RealOdds>();
  for (const ev of events) {
    const odds: RealOdds = {};

    // 1X2 — first bookmaker that prices h2h.
    for (const bk of ev.bookmakers ?? []) {
      const h2h = bk.markets?.find((m) => m.key === 'h2h');
      if (!h2h) continue;
      const home = h2h.outcomes.find((o) => o.name === ev.home_team)?.price;
      const away = h2h.outcomes.find((o) => o.name === ev.away_team)?.price;
      const draw = h2h.outcomes.find((o) => o.name === 'Draw')?.price;
      if (home && away && draw) {
        odds['1x2'] = { home, draw, away };
        break;
      }
    }

    // Over/Under 2.5 — first bookmaker with the 2.5 line.
    for (const bk of ev.bookmakers ?? []) {
      const totals = bk.markets?.find((m) => m.key === 'totals');
      const over = totals?.outcomes.find((o) => o.name === 'Over' && o.point === 2.5)?.price;
      const under = totals?.outcomes.find((o) => o.name === 'Under' && o.point === 2.5)?.price;
      if (over && under) {
        odds.ou25 = { over, under };
        break;
      }
    }

    if (Object.keys(odds).length > 0) map.set(oddsKey(ev.home_team, ev.away_team), odds);
  }
  return map;
}
