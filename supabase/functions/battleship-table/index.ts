// Supabase Edge Function: battleship-table
//
// Server-authoritative online 1v1 Battleship. Two humans place a classic fleet
// (5/4/3/3/2) on a hidden 10×10 board, then alternate single shots; first to
// sink the enemy fleet wins. The full state (both boards) lives in
// battleship_tables.state, which has NO client SELECT policy — each caller only
// ever receives a masked view (their own fleet + their shot results + sunk enemy
// ships). No money — it's a "for fun" match. Matchmaking: invite-by-code OR a
// public "find opponent" queue (the first waiting public table is claimed).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  freshState,
  addGuest,
  validateFleet,
  maybeStart,
  fire as fireAt,
  forfeit,
  rematch as resetForRematch,
  viewFor,
  type BattleState,
} from '../_shared/battleship.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Row = {
  id: number; code: string; host_id: string; guest_id: string | null;
  is_public: boolean; status: string; state: BattleState; version: number;
};
const COLS = 'id, code, host_id, guest_id, is_public, status, state, version';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...corsHeaders } });

function genCode(): string {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => a[b % a.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await userClient.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: 'unauthorized' }, 401);
  const uid = user.id;

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const myName = async (): Promise<string> =>
    (await db.from('profiles').select('display_name').eq('id', uid).maybeSingle()).data?.display_name ?? 'Jogador';

  const out = (row: Row) => ({ view: viewFor(row.state, uid), tableId: row.id, code: row.code, isPublic: row.is_public });

  // My current (non-finished) game, optionally a specific id.
  const loadMine = async (id?: number): Promise<Row | null> => {
    let q = db.from('battleship_tables').select(COLS).or(`host_id.eq.${uid},guest_id.eq.${uid}`).neq('status', 'finished');
    if (id != null) q = q.eq('id', id);
    const { data } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
    return (data as Row) ?? null;
  };
  // A specific table I belong to, finished or not (for rematch).
  const loadAnyById = async (id: number): Promise<Row | null> => {
    const { data } = await db.from('battleship_tables').select(COLS).eq('id', id).or(`host_id.eq.${uid},guest_id.eq.${uid}`).maybeSingle();
    return (data as Row) ?? null;
  };

  const persist = async (id: number, patch: Record<string, unknown>, expected: number): Promise<boolean> => {
    const { data } = await db.from('battleship_tables')
      .update({ ...patch, version: expected + 1, updated_at: new Date().toISOString() })
      .eq('id', id).eq('version', expected).select('id');
    return (data?.length ?? 0) > 0;
  };

  // Optimistic-concurrency wrapper for actions on an existing table I'm in.
  const withCAS = async (
    id: number,
    finished: boolean,
    mutate: (row: Row) => { patch: Record<string, unknown>; result: unknown } | Response,
  ): Promise<Response> => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = finished ? await loadAnyById(id) : await loadMine(id);
      if (!row) return json({ error: 'table not found' }, 404);
      const o = mutate(row);
      if (o instanceof Response) return o;
      if (await persist(row.id, o.patch, row.version)) return json(o.result);
    }
    return json({ error: 'conflict' }, 409);
  };

  let body: { op?: string; tableId?: number; code?: string; isPublic?: boolean; cell?: number; ships?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }

  switch (body.op) {
    // Resume: my current game (or null).
    case 'mine': {
      const row = await loadMine();
      return json(row ? out(row) : { view: null });
    }

    case 'state': {
      // Load by id regardless of status so the result screen persists after a
      // game finishes (until the player leaves / starts a new one).
      const row = body.tableId != null ? await loadAnyById(body.tableId) : await loadMine();
      return json(row ? out(row) : { view: null });
    }

    // Create a private (code) or public (queue) table.
    case 'create': {
      const mine = await loadMine();
      if (mine) return json(out(mine)); // one game at a time
      const state = freshState(uid, await myName());
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data, error } = await db.from('battleship_tables')
          .insert({ code: genCode(), host_id: uid, is_public: !!body.isPublic, status: 'waiting', state, version: 0 })
          .select(COLS).maybeSingle();
        if (!error && data) return json(out(data as Row));
      }
      return json({ error: 'could not create table' }, 500);
    }

    // Public matchmaking: join the oldest waiting public table, else open one.
    case 'find': {
      const mine = await loadMine();
      if (mine) return json(out(mine));
      const name = await myName();
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: cand } = await db.from('battleship_tables').select(COLS)
          .eq('status', 'waiting').eq('is_public', true).is('guest_id', null).neq('host_id', uid)
          .order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (!cand) break;
        const row = cand as Row;
        const state = row.state;
        addGuest(state, uid, name);
        const { data: claimed } = await db.from('battleship_tables')
          .update({ guest_id: uid, status: 'placing', state, version: row.version + 1, updated_at: new Date().toISOString() })
          .eq('id', row.id).is('guest_id', null).eq('version', row.version).select(COLS).maybeSingle();
        if (claimed) return json(out(claimed as Row));
        // lost the race — try the next candidate
      }
      // none free → open a public table and wait
      const state = freshState(uid, name);
      const { data } = await db.from('battleship_tables')
        .insert({ code: genCode(), host_id: uid, is_public: true, status: 'waiting', state, version: 0 })
        .select(COLS).maybeSingle();
      return data ? json(out(data as Row)) : json({ error: 'could not create table' }, 500);
    }

    // Join a private table by its code.
    case 'join': {
      const code = String(body.code ?? '').toUpperCase().trim();
      if (!code) return json({ error: 'bad request' }, 400);
      const { data } = await db.from('battleship_tables').select(COLS).eq('code', code).neq('status', 'finished').maybeSingle();
      if (!data) return json({ error: 'table not found' }, 404);
      const row = data as Row;
      if (row.host_id === uid || row.guest_id === uid) return json(out(row));
      if (row.guest_id) return json({ error: 'table full' }, 409);
      if (row.status !== 'waiting') return json({ error: 'already started' }, 409);
      const mine = await loadMine();
      if (mine) return json({ error: 'leave your current game first' }, 409);
      const state = row.state;
      addGuest(state, uid, await myName());
      const { data: claimed } = await db.from('battleship_tables')
        .update({ guest_id: uid, status: 'placing', state, version: row.version + 1, updated_at: new Date().toISOString() })
        .eq('id', row.id).is('guest_id', null).eq('version', row.version).select(COLS).maybeSingle();
      return claimed ? json(out(claimed as Row)) : json({ error: 'table full' }, 409);
    }

    // Submit my fleet.
    case 'place': {
      if (body.tableId == null) return json({ error: 'bad request' }, 400);
      return withCAS(body.tableId, false, (row) => {
        if (row.state.phase !== 'placing') return json({ error: 'already started' }, 409);
        if (row.state.players[uid]?.ships) return json({ error: 'already placed' }, 409);
        const v = validateFleet(body.ships);
        if (!v.ok) return json({ error: v.error ?? 'invalid fleet' }, 400);
        row.state.players[uid]!.ships = v.ships!;
        maybeStart(row.state);
        const status = row.state.phase === 'playing' ? 'playing' : row.status;
        return { patch: { state: row.state, status }, result: out(row) };
      });
    }

    // Fire a shot.
    case 'fire': {
      if (body.tableId == null || body.cell == null) return json({ error: 'bad request' }, 400);
      const cell = body.cell;
      return withCAS(body.tableId, false, (row) => {
        if (row.state.phase !== 'playing') return json({ error: 'not in play' }, 409);
        if (row.state.turn !== uid) return json({ error: 'not your turn' }, 409);
        if (!Number.isInteger(cell) || cell < 0 || cell >= 100) return json({ error: 'invalid cell' }, 400);
        if (row.state.players[uid]!.shots.includes(cell)) return json({ error: 'already fired' }, 409);
        const o = fireAt(row.state, uid, cell);
        const status = row.state.phase === 'finished' ? 'finished' : row.status;
        return { patch: { state: row.state, status }, result: { ...out(row), outcome: o } };
      });
    }

    // Rematch — reset both boards.
    case 'rematch': {
      if (body.tableId == null) return json({ error: 'bad request' }, 400);
      return withCAS(body.tableId, true, (row) => {
        if (row.state.phase !== 'finished') return { patch: {}, result: out(row) };
        resetForRematch(row.state);
        return { patch: { state: row.state, status: 'placing' }, result: out(row) };
      });
    }

    // Leave / forfeit.
    case 'leave': {
      if (body.tableId == null) return json({ error: 'bad request' }, 400);
      return withCAS(body.tableId, false, (row) => {
        forfeit(row.state, uid);
        return { patch: { state: row.state, status: 'finished' }, result: { view: null } };
      });
    }

    default:
      return json({ error: 'unknown op' }, 400);
  }
});
