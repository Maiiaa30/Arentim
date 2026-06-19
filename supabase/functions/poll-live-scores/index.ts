// Supabase Edge Function: poll-live-scores
//
// Polls API-Football's live feed and pushes score/minute/event updates into
// public.fixtures (which streams to clients over Realtime). When a fixture
// finishes, it records the final score and auto-settles its bets via the
// idempotent settle_fixture RPC. Intended to run on a short schedule, but only
// touches fixtures it already knows about, so off-window runs are cheap no-ops.
//
// Same guardrails as sync-fixtures: key in secrets, fixed allowlisted host,
// shared-secret auth that fails closed. Deploy/schedule: docs/EDGE_FUNCTIONS.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { apiFootballGet, parseLive } from '../_shared/apiFootball.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_KEY = Deno.env.get('API_FOOTBALL_KEY') ?? '';
const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? '';

Deno.serve(async (req) => {
  if (!SYNC_SECRET || req.headers.get('x-sync-secret') !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let live;
  try {
    const raw = await apiFootballGet<unknown>('/fixtures', { live: 'all' }, API_KEY);
    live = parseLive(raw as never[]);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 502 });
  }

  let updated = 0;
  let settled = 0;

  for (const f of live) {
    // Only update fixtures we already track (avoid inserting unrelated leagues).
    const { data: existing } = await supabase
      .from('fixtures')
      .select('id, status')
      .eq('external_ref', f.external_ref)
      .maybeSingle();
    if (!existing) continue;

    await supabase
      .from('fixtures')
      .update({
        status: f.status,
        minute: f.minute,
        home_score: f.home_score,
        away_score: f.away_score,
        events: f.events,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    updated += 1;

    // Auto-settle on full-time (idempotent: settle_fixture only touches pending rows).
    if (f.status === 'finished' && existing.status !== 'finished' && f.home_score != null && f.away_score != null) {
      const { error } = await supabase.rpc('settle_fixture', { p_fixture_id: existing.id });
      if (!error) settled += 1;
    }
  }

  return new Response(JSON.stringify({ ok: true, updated, settled }), {
    headers: { 'content-type': 'application/json' },
  });
});
