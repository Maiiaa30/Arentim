// Supabase Edge Function: match-stats
//
// On-demand LIVE match statistics for the Resultados popup. The app's fixtures
// come from Football-Data.org (no live stats on the free tier), so we fetch
// stats from API-Football (api-sports.io) and match the fixture by team name +
// "currently live" set. The provider's fixture id is cached on the row
// (stats_ref) so we only resolve the match once; the parsed stats are cached in
// fixtures.live_stats for ~45s so opening the popup doesn't burn the API quota.
//
// Requires the FOOTBALL_STATS_KEY secret (an api-sports.io key). Without it the
// function simply reports stats unavailable — nothing else breaks.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STATS_KEY = Deno.env.get('FOOTBALL_STATS_KEY') ?? '';
const API = 'https://v3.football.api-sports.io';
const CACHE_MS = 45_000;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...corsHeaders } });

/** Normalise a club name so "SL Benfica" / "Benfica" / "Sporting CP" match. */
function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|cf|sc|sl|ac|cd|ud|sad|club|clube|de|do|da|futebol|cp|calcio|afc|ssc|us|as|rc|bk|if)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}
function teamsMatch(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

type ApiStat = { type: string; value: number | string | null };
type ApiTeamStats = { team?: { name?: string }; statistics?: ApiStat[] };

function pick(arr: ApiStat[] | undefined, type: string): number | string | null {
  const e = (arr ?? []).find((x) => x.type === type);
  return e ? e.value : null;
}
function build(t: ApiTeamStats) {
  const a = t.statistics;
  return {
    possession: pick(a, 'Ball Possession'),
    shots: pick(a, 'Total Shots'),
    shotsOn: pick(a, 'Shots on Goal'),
    corners: pick(a, 'Corner Kicks'),
    fouls: pick(a, 'Fouls'),
    yellow: pick(a, 'Yellow Cards'),
    red: pick(a, 'Red Cards'),
    offsides: pick(a, 'Offsides'),
    passAcc: pick(a, 'Passes %'),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Require an authenticated caller so the external stats quota can't be burned
  // by anonymous traffic.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth?.user) return json({ available: false, reason: 'unauthorized' }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: { fixtureId?: number };
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const fixtureId = Number(body.fixtureId);
  if (!Number.isInteger(fixtureId)) return json({ error: 'bad request' }, 400);

  const { data: fx } = await db
    .from('fixtures')
    .select('id, home, away, status, stats_ref, live_stats')
    .eq('id', fixtureId)
    .maybeSingle();
  if (!fx) return json({ available: false, reason: 'not_found' });

  const cached = (fx.live_stats ?? {}) as Record<string, unknown>;
  const hasCache = cached && typeof cached === 'object' && 'home' in cached;

  // Only the live state pulls fresh data; otherwise serve whatever we cached.
  if (fx.status !== 'live') {
    return json({ available: hasCache, stats: hasCache ? cached : null, cached: true });
  }
  if (!STATS_KEY) return json({ available: false, reason: 'no_key' });

  // Serve a fresh cache without hitting the API.
  const at = typeof cached.__at === 'string' ? Date.parse(cached.__at) : 0;
  if (hasCache && at && Date.now() - at < CACHE_MS) {
    return json({ available: true, stats: cached, cached: true });
  }

  const headers = { 'x-apisports-key': STATS_KEY };
  try {
    let afId: number | null = fx.stats_ref ? Number(fx.stats_ref) : null;
    if (!afId || Number.isNaN(afId)) {
      const r = await fetch(`${API}/fixtures?live=all`, { headers });
      const j = await r.json();
      const list: Array<{ fixture: { id: number }; teams?: { home?: { name?: string }; away?: { name?: string } } }> = j.response ?? [];
      const m = list.find(
        (it) => teamsMatch(it.teams?.home?.name ?? '', fx.home) && teamsMatch(it.teams?.away?.name ?? '', fx.away),
      );
      if (m) {
        afId = m.fixture.id;
        await db.from('fixtures').update({ stats_ref: String(afId) }).eq('id', fixtureId);
      }
    }
    if (!afId) return json({ available: false, reason: 'no_match' });

    const sr = await fetch(`${API}/fixtures/statistics?fixture=${afId}`, { headers });
    const sj = await sr.json();
    const teams: ApiTeamStats[] = sj.response ?? [];
    if (teams.length < 2) return json({ available: false, reason: 'no_stats' });

    let homeT = teams.find((t) => teamsMatch(t.team?.name ?? '', fx.home));
    let awayT = teams.find((t) => teamsMatch(t.team?.name ?? '', fx.away));
    if (!homeT || !awayT) { homeT = teams[0]; awayT = teams[1]; }

    const stats = { home: build(homeT!), away: build(awayT!), __at: new Date().toISOString() };
    await db.from('fixtures').update({ live_stats: stats }).eq('id', fixtureId);
    return json({ available: true, stats, cached: false });
  } catch (e) {
    console.error('match-stats error', e);
    return json({ available: false, reason: 'error' });
  }
});
