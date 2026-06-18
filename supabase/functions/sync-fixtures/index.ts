// Supabase Edge Function: sync-fixtures
//
// Pulls upcoming fixtures + pre-match odds for the configured leagues from
// API-Football and upserts them into public.fixtures. Runs on a daily schedule
// (and can be invoked manually by an admin). The API-Football key lives ONLY in
// this function's secrets — it never reaches the browser. Fetches are locked to
// a fixed allowlisted host (SSRF-safe). Invocation is gated by a shared secret.
//
// Deploy + schedule: see docs/EDGE_FUNCTIONS.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  SYNCED_LEAGUES,
  apiFootballGet,
  parseFixtures,
  parseOdds,
} from '../_shared/apiFootball.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_KEY = Deno.env.get('API_FOOTBALL_KEY') ?? '';
const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? '';
const SEASON = Number(Deno.env.get('FOOTBALL_SEASON') ?? new Date().getUTCFullYear());

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  // Authorize: a shared secret the scheduler/admin sends. Fail closed.
  if (!SYNC_SECRET || req.headers.get('x-sync-secret') !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const from = ymd(new Date());
  const to = ymd(new Date(Date.now() + 14 * 86_400_000));

  const summary: Record<string, number> = {};
  try {
    for (const league of SYNCED_LEAGUES) {
      const rawFixtures = await apiFootballGet<unknown>(
        '/fixtures',
        { league: league.id, season: SEASON, from, to },
        API_KEY,
      );
      const fixtures = parseFixtures(rawFixtures as never[], league.name);
      if (fixtures.length === 0) {
        summary[league.name] = 0;
        continue;
      }

      // Odds for the league (one request keeps us under the free quota).
      let oddsByRef = new Map<string, Record<string, Record<string, number>>>();
      try {
        const rawOdds = await apiFootballGet<unknown>(
          '/odds',
          { league: league.id, season: SEASON },
          API_KEY,
        );
        oddsByRef = new Map(parseOdds(rawOdds as never[]).map((o) => [o.external_ref, o.odds]));
      } catch (_) {
        // Odds are best-effort; fixtures still sync without them.
      }

      const rows = fixtures.map((f) => ({
        ...f,
        odds: oddsByRef.get(f.external_ref) ?? {},
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('fixtures')
        .upsert(rows, { onConflict: 'external_ref' });
      if (error) throw error;
      summary[league.name] = rows.length;
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, synced: summary }), {
    headers: { 'content-type': 'application/json' },
  });
});
