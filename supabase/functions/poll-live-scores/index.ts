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
import { fetchMatchesByDate, fetchMatchById, mapStatus, score } from '../_shared/footballData.ts';

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
  const day = 86400000;
  // Widen the window to yesterday→tomorrow so games that straddle UTC midnight
  // (late kickoffs) are always covered, not just "today" in UTC.
  const from = ymd(new Date(Date.now() - day));
  const to = ymd(new Date(Date.now() + day));

  let matches;
  try {
    matches = await fetchMatchesByDate(TOKEN, from, to);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 502 });
  }

  let updated = 0;
  let settled = 0;
  const seen = new Set<string>();

  for (const m of matches) {
    const ref = `fd:${m.id}`;
    const { data: existing } = await supabase
      .from('fixtures')
      .select('id, status')
      .eq('external_ref', ref)
      .maybeSingle();
    if (!existing) continue; // only update fixtures we already synced
    seen.add(ref);

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

  // Reconcile fixtures stuck in 'live' that the window above didn't cover (e.g.
  // a game that finished while the cron was down). Fetch each by id to get its
  // authoritative final, update it, and settle. Capped to stay well under the
  // API's free-tier limit.
  let reconciled = 0;
  try {
    const { data: stuck } = await supabase.from('fixtures').select('id, external_ref').eq('status', 'live');
    for (const f of stuck ?? []) {
      if (reconciled >= 12) break;
      if (!f.external_ref || seen.has(f.external_ref) || !f.external_ref.startsWith('fd:')) continue;
      const fdId = Number(f.external_ref.slice(3));
      if (!Number.isFinite(fdId)) continue;
      const m = await fetchMatchById(TOKEN, fdId);
      if (!m) continue;
      const status = mapStatus(m.status);
      const { home, away } = score(m);
      await supabase.from('fixtures').update({
        status, minute: m.minute ?? null, home_score: home, away_score: away, updated_at: new Date().toISOString(),
      }).eq('id', f.id);
      reconciled += 1;
      if (status === 'finished' && home != null && away != null) {
        const { error } = await supabase.rpc('settle_fixture', { p_fixture_id: f.id });
        if (!error) settled += 1;
      }
    }
  } catch (_) { /* best-effort */ }

  // Catch-up sweep: settle ANY finished fixture that still has pending bets.
  // Covers games marked 'finished' by the daily sync (not just live
  // transitions this run) — otherwise their bets stay pending forever.
  // settle_fixture only touches pending legs/bets, so this is idempotent.
  try {
    const { data: pending } = await supabase.from('bet_selections').select('fixture_id').eq('result', 'pending');
    const ids = [...new Set((pending ?? []).map((p) => p.fixture_id))];
    if (ids.length) {
      const { data: finished } = await supabase
        .from('fixtures')
        .select('id')
        .in('id', ids)
        .eq('status', 'finished')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null);
      for (const f of finished ?? []) {
        const { error } = await supabase.rpc('settle_fixture', { p_fixture_id: f.id });
        if (!error) settled += 1;
      }
    }
  } catch (_) {
    // best-effort sweep; the per-match loop above is the primary path
  }

  return new Response(JSON.stringify({ ok: true, updated, settled, reconciled }), {
    headers: { 'content-type': 'application/json' },
  });
});
