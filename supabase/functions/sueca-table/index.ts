// Supabase Edge Function: sueca-table
//
// Server-authoritative multiplayer Sueca for 2–4 humans; empty seats are filled
// with bots. Holds the deck + every seat's cards in sueca_tables.state and hands
// each caller only their own seat's view. Seats 0 & 2 form one team, 1 & 3 the
// other, so choosing a seat chooses your partnership. No money — it's the social
// card game.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  deal,
  playTurn,
  collectTrick,
  type SuecaState,
} from '../_shared/sueca.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { randomBotName } from '../_shared/botNames.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Seat = { user: string | null; name: string; bot: boolean } | null;
type Row = {
  id: number; code: string; host_id: string; status: string;
  seats: Seat[]; state: SuecaState | null; match: [number, number]; dealer: number;
};

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...corsHeaders } });

function genCode(): string {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => a[b % a.length]).join('');
}

const TURN_MS = 30_000; // a human has this long to play before the turn auto-plays

/**
 * Play out bot turns until a human is to act, a trick completes, or the hand
 * ends — collecting a snapshot after EACH bot card so the client can replay
 * them one at a time (a visible "thinking" delay) instead of all at once.
 */
function advance(state: SuecaState, isBot: (seat: number) => boolean): { state: SuecaState; trail: SuecaState[] } {
  let s = state;
  const trail: SuecaState[] = [];
  let guard = 0;
  while (!s.done && !s.trickComplete && guard++ < 100) {
    if (!isBot(s.turn)) break;
    s = playTurn(s, -1);
    trail.push(s);
  }
  return { state: s, trail };
}

/** Set/clear the current turn's deadline — only while a HUMAN is to act. */
function stamp(row: Row): void {
  const st = row.state;
  if (!st) return;
  const humanToAct = st.turn >= 0 && !row.seats[st.turn]?.bot && !st.done && !st.trickComplete;
  st.turnDeadline = humanToAct ? new Date(Date.now() + TURN_MS).toISOString() : null;
}

function viewFor(t: Row, uid: string, stOverride?: SuecaState) {
  const mySeat = t.seats.findIndex((s) => s && s.user === uid);
  const st = stOverride ?? t.state;
  const base = {
    table_id: t.id, code: t.code, status: t.status, host: t.host_id === uid, mySeat,
    match: t.match,
    seats: t.seats.map((s, i) => ({
      seat: i, name: s ? s.name : 'Vazio', bot: s ? !!s.bot : false,
      isMe: !!s && s.user === uid, present: !!s, cards: st ? (st.hands[i]?.length ?? 0) : 0,
    })),
  };
  if (!st) return base;
  return {
    ...base,
    trump: st.trump, trumpCard: st.trumpCard, turn: st.turn, leader: st.leader,
    trick: st.trick.map((p) => ({ seat: p.player, card: p.card })),
    capturedA: st.captured[0], capturedB: st.captured[1],
    tricksPlayed: st.tricksPlayed, trickComplete: st.trickComplete,
    done: st.done, result: st.result, dealer: st.dealer,
    log: st.log.slice(-6),
    myHand: mySeat >= 0 ? st.hands[mySeat] : [],
    turnDeadline: st.turnDeadline,
    readyNext: st.readyNext,
  };
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
  let body: { op?: string; code?: string; tableId?: number; seat?: number; card?: number };
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }

  const name = async () =>
    (await db.from('profiles').select('display_name').eq('id', uid).single()).data?.display_name ?? 'Jogador';

  const load = async (tableId?: number): Promise<Row | null> => {
    const ids = (await db.from('sueca_table_members').select('table_id').eq('user_id', uid)).data?.map((m) => m.table_id) ?? [];
    if (ids.length === 0) return null;
    let q = db.from('sueca_tables').select('id, code, host_id, status, seats, state, match, dealer').neq('status', 'closed').in('id', ids);
    if (tableId != null) q = q.eq('id', tableId);
    const { data } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
    return data as Row | null;
  };

  const persist = (row: Row) =>
    db.from('sueca_tables').update({
      seats: row.seats, state: row.state, status: row.status, match: row.match, dealer: row.dealer, updated_at: new Date().toISOString(),
    }).eq('id', row.id);

  const isBot = (row: Row) => (seat: number) => !!row.seats[seat]?.bot;

  // Standard response: the caller's masked view, an optional bot-replay trail,
  // and the server clock (so the client countdown corrects for skew).
  const respond = (row: Row, trail: SuecaState[] = []) =>
    json({
      view: viewFor(row, uid),
      trail: trail.map((st) => viewFor(row, uid, st)),
      serverNow: new Date().toISOString(),
    });

  // Score the finished hand, rotate the dealer, deal the next one and play out any
  // opening bot turns. Returns the bot-replay trail.
  const dealNext = (row: Row): SuecaState[] => {
    const r = row.state!.result;
    if (r && r.winner !== null) row.match[r.winner] += r.games;
    row.dealer = (row.dealer + 1) % 4;
    const adv = advance(deal(rand, row.dealer), isBot(row));
    row.state = adv.state;
    stamp(row);
    return adv.trail;
  };

  // Every present human must be ready before the next hand deals (bots auto-ready).
  const allReady = (row: Row): boolean =>
    row.seats.every((s, i) => !s || s.bot || !!row.state?.readyNext[i]);

  switch (body.op) {
    case 'create': {
      const seats: Seat[] = [{ user: uid, name: await name(), bot: false }, null, null, null];
      const code = genCode();
      const { data: row, error } = await db.from('sueca_tables').insert({ code, host_id: uid, seats }).select('id').single();
      if (error) return json({ error: 'could not create table' }, 500);
      await db.from('sueca_table_members').insert({ table_id: row.id, user_id: uid });
      const full = await load(row.id);
      return json({ view: full ? viewFor(full, uid) : null });
    }

    case 'join': {
      const code = String(body.code ?? '').toUpperCase().trim();
      const { data: row } = await db.from('sueca_tables').select('id, code, host_id, status, seats, state, match, dealer').eq('code', code).neq('status', 'closed').maybeSingle();
      if (!row) return json({ error: 'mesa não encontrada' }, 404);
      const r = row as Row;
      if (r.seats.some((s) => s && s.user === uid)) {
        await db.from('sueca_table_members').upsert({ table_id: r.id, user_id: uid });
        return json({ view: viewFor(r, uid) });
      }
      if (r.status !== 'open') return json({ error: 'a mesa já começou' }, 409);
      const free = r.seats.findIndex((s) => s == null);
      if (free < 0) return json({ error: 'mesa cheia' }, 409);
      r.seats[free] = { user: uid, name: await name(), bot: false };
      await db.from('sueca_table_members').upsert({ table_id: r.id, user_id: uid });
      await persist(r);
      return json({ view: viewFor(r, uid) });
    }

    case 'seat': {
      const row = await load(body.tableId);
      if (!row) return json({ error: 'sem mesa' }, 404);
      if (row.status !== 'open') return json({ error: 'a mesa já começou' }, 409);
      const target = Number(body.seat);
      if (!Number.isInteger(target) || target < 0 || target > 3) return json({ error: 'lugar inválido' }, 400);
      if (row.seats[target] != null) return json({ error: 'lugar ocupado' }, 409);
      const cur = row.seats.findIndex((s) => s && s.user === uid);
      const me = cur >= 0 ? row.seats[cur] : { user: uid, name: await name(), bot: false };
      if (cur >= 0) row.seats[cur] = null;
      row.seats[target] = me;
      await persist(row);
      return json({ view: viewFor(row, uid) });
    }

    case 'start': {
      const row = await load(body.tableId);
      if (!row) return json({ error: 'sem mesa' }, 404);
      if (row.host_id !== uid) return json({ error: 'só o anfitrião pode começar' }, 403);
      // Fill empty seats with bots.
      const taken = row.seats.filter(Boolean).map((s) => s!.name);
      for (let i = 0; i < 4; i++) {
        if (row.seats[i] == null) {
          const bn = randomBotName(taken);
          taken.push(bn);
          row.seats[i] = { user: null, name: bn, bot: true };
        }
      }
      const adv = advance(deal(rand, row.dealer), isBot(row));
      row.state = adv.state;
      row.status = 'playing';
      stamp(row);
      await persist(row);
      return respond(row, adv.trail);
    }

    case 'play': {
      const row = await load(body.tableId);
      if (!row || !row.state) return json({ error: 'sem jogo' }, 404);
      const mySeat = row.seats.findIndex((s) => s && s.user === uid);
      const card = Number(body.card);
      if (mySeat >= 0 && row.state.turn === mySeat && !row.state.trickComplete && !row.state.done) {
        const afterHuman = playTurn(row.state, mySeat, card);
        const adv = advance(afterHuman, isBot(row));
        row.state = adv.state;
        stamp(row);
        await persist(row);
        // Lead with the human's own card, then each bot card, then the rest.
        return respond(row, [afterHuman, ...adv.trail]);
      }
      return respond(row);
    }

    case 'collect': {
      const row = await load(body.tableId);
      if (!row || !row.state) return json({ error: 'sem jogo' }, 404);
      if (row.state.trickComplete) {
        const afterCollect = collectTrick(row.state);
        const adv = advance(afterCollect, isBot(row));
        row.state = adv.state;
        stamp(row);
        await persist(row);
        return respond(row, [afterCollect, ...adv.trail]);
      }
      return respond(row);
    }

    case 'deal': {
      const row = await load(body.tableId);
      if (!row || !row.state) return json({ error: 'sem jogo' }, 404);
      if (row.host_id !== uid) return json({ error: 'só o anfitrião' }, 403);
      if (!row.state.done) return json({ error: 'mão a decorrer' }, 409);
      const trail = dealNext(row);
      await persist(row);
      return respond(row, trail);
    }

    // Mark myself ready for the next hand; deal once every present human is ready.
    case 'ready': {
      const row = await load(body.tableId);
      if (!row || !row.state) return json({ error: 'sem jogo' }, 404);
      if (!row.state.done) return json({ error: 'mão a decorrer' }, 409);
      const mySeat = row.seats.findIndex((s) => s && s.user === uid);
      if (mySeat < 0) return json({ error: 'não está sentado' }, 403);
      row.state.readyNext[mySeat] = true;
      const trail = allReady(row) ? dealNext(row) : [];
      await persist(row);
      return respond(row, trail);
    }

    // Cancel my ready status (while still waiting for the others).
    case 'unready': {
      const row = await load(body.tableId);
      if (!row || !row.state) return json({ error: 'sem jogo' }, 404);
      const mySeat = row.seats.findIndex((s) => s && s.user === uid);
      if (mySeat >= 0 && row.state.done) row.state.readyNext[mySeat] = false;
      await persist(row);
      return respond(row);
    }

    // Turn timed out — auto-play a legal card for the human on the clock, then
    // pass. Any client may call it; the server only acts once expired.
    case 'timeout': {
      const row = await load(body.tableId);
      if (!row || !row.state) return json({ error: 'sem jogo' }, 404);
      const st = row.state;
      if (st.done || st.trickComplete || st.turn < 0 || row.seats[st.turn]?.bot) return respond(row);
      if (!st.turnDeadline || Date.now() <= Date.parse(st.turnDeadline)) return respond(row);
      const afterAuto = playTurn(st, -1); // current human seat auto-plays via bot heuristic
      const adv = advance(afterAuto, isBot(row));
      row.state = adv.state;
      stamp(row);
      await persist(row);
      return respond(row, [afterAuto, ...adv.trail]);
    }

    case 'leave': {
      const row = await load(body.tableId);
      if (!row) return json({ error: 'sem mesa' }, 404);
      const seat = row.seats.findIndex((s) => s && s.user === uid);
      if (seat >= 0) row.seats[seat] = null;
      await db.from('sueca_table_members').delete().eq('table_id', row.id).eq('user_id', uid);
      const humans = row.seats.filter((s) => s && !s.bot).length;
      row.status = humans === 0 ? 'closed' : row.status;
      await persist(row);
      return json({ left: true });
    }

    case 'state': {
      const row = await load(body.tableId);
      if (!row) return json({ view: null });
      return respond(row);
    }

    default:
      return json({ error: 'unknown op' }, 400);
  }
});
