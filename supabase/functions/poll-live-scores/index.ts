// Supabase Edge Function: poll-live-scores
//
// Polls Football-Data.org for today's matches and pushes score/minute/status
// updates into public.fixtures (which streams to clients over Realtime). When a
// fixture finishes, it records the final score and auto-settles its bets via the
// idempotent settle_fixture RPC. Only touches fixtures it already tracks, so
// off-window runs are cheap. One API call per run (well under the free limit).
//
// Same guardrails as sync-fixtures: token in secrets, fixed allowlisted host,
// shared-secret auth that fails closed. Setup/schedule: docs/EDGE_FUNCTIONS.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { fetchMatchesByDate, mapStatus, score } from '../_shared/footballData.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN = Deno.env.get('FOOTBALL_DATA_TOKEN') ?? '';
const SYNC_SECRET = Deno.env.get('SYNC_SECRET') ?? '';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (!SYNC_SECRET || req.headers.get('x-sync-secret') !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: 'FOOTBALL_DATA_TOKEN not configured' }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const today = ymd(new Date());

  let matches;
  try {
    matches = await fetchMatchesByDate(TOKEN, today, today);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 502 });
  }

  let updated = 0;
  let settled = 0;

  for (const m of matches) {
    const ref = `fd:${m.id}`;
    const { data: existing } = await supabase
      .from('fixtures')
      .select('id, status')
      .eq('external_ref', ref)
      .maybeSingle();
    if (!existing) continue; // only update fixtures we already synced

    const status = mapStatus(m.status);
    const { home, away } = score(m);
    await supabase
      .from('fixtures')
      .update({
        status,
        minute: m.minute ?? null,
        home_score: home,
        away_score: away,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    updated += 1;

    if (status === 'finished' && existing.status !== 'finished' && home != null && away != null) {
      const { error } = await supabase.rpc('settle_fixture', { p_fixture_id: existing.id });
      if (!error) settled += 1;
    }
  }

  return new Response(JSON.stringify({ ok: true, updated, settled }), {
    headers: { 'content-type': 'application/json' },
  });
});
