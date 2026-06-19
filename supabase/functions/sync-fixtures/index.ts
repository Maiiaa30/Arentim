// Supabase Edge Function: sync-fixtures
//
// Pulls upcoming fixtures from Football-Data.org (free tier) for the configured
// competitions and upserts them into public.fixtures with GENERATED realistic
// odds (a Poisson model fed by each team's live form — see _shared/footballData).
// Runs on a daily schedule (and can be invoked manually by an admin). The
// Football-Data token lives ONLY in this function's secrets. Fetches are locked
// to the single allowlisted host (SSRF-safe). Invocation is gated by a shared
// secret. Free-tier rate limit is 10 req/min, so calls are spaced out.
//
// Setup + schedule: see docs/EDGE_FUNCTIONS.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  FD_COMPETITIONS,
  computeOdds,
  fetchMatches,
  fetchStrength,
  mapStatus,
  seasonYear,
  sleep,
  teamName,
} from '../_shared/footballData.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN = Deno.env.get('FOOTBALL_DATA_TOKEN') ?? '';
const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? '';
const GAP_MS = 6500; // keep under the 10 req/min free limit

const ymd = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (!SYNC_SECRET || req.headers.get('x-sync-secret') !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: 'FOOTBALL_DATA_TOKEN not configured' }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const from = ymd(new Date());
  const to = ymd(new Date(Date.now() + 10 * 86_400_000));
  const summary: Record<string, number | string> = {};
  let first = true;

  for (const comp of FD_COMPETITIONS) {
    try {
      if (!first) await sleep(GAP_MS);
      first = false;
      const strength = await fetchStrength(comp.code, TOKEN);
      await sleep(GAP_MS);
      const matches = await fetchMatches(comp.code, TOKEN, from, to);

      const rows = matches
        .filter((m) => mapStatus(m.status) === 'scheduled')
        .map((m) => {
          const home = teamName(m.homeTeam);
          const away = teamName(m.awayTeam);
          return {
            external_ref: `fd:${m.id}`,
            league: comp.name,
            season: seasonYear(m),
            home,
            away,
            kickoff: m.utcDate,
            status: 'scheduled',
            odds: computeOdds(home, away, strength),
            updated_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        const { error } = await supabase.from('fixtures').upsert(rows, { onConflict: 'external_ref' });
        if (error) throw error;
      }
      summary[comp.name] = rows.length;
    } catch (err) {
      // One competition failing (rate limit, no standings yet, etc.) must not
      // abort the whole sync.
      summary[comp.name] = `error: ${String(err)}`;
    }
  }

  return new Response(JSON.stringify({ ok: true, window: { from, to }, synced: summary }), {
    headers: { 'content-type': 'application/json' },
  });
});
