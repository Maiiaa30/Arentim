// Supabase Edge Function: poker-table
//
// Server-authoritative multiplayer Texas Hold'em for private friend tables.
// Holds the deck + every player's hole cards in poker_tables (no client read);
// each caller receives only their own sanitized view. Empty seats can be filled
// with bots, which the engine auto-plays. Buy-ins/cash-outs use apply_ledger_entry.
// Turn timeouts are enforced lazily: a player past their deadline is auto-folded
// on the next request.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  addPlayer,
  applyActionFor,
  createMultiTable,
  removePlayer,
  startHand,
  viewFor,
  type TableState,
} from '../_shared/pokerTable.ts';
import type { BotDifficulty, PokerAction } from '../_shared/poker.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TURN_MS = 30_000;

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });

function genCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

type Row = { id: number; host_id: string; status: string; buy_in: number; state: TableState; turn_deadline: string | null };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await userClient.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: { op?: string; code?: string; buyIn?: number; difficulty?: string; action?: string; raiseTo?: number; tableId?: number };
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }

  const name = async () =>
    (await db.from('profiles').select('display_name').eq('id', user.id).single()).data?.display_name ?? 'Player';

  const deadlineFor = (s: TableState): string | null => {
    if (s.handOver || s.toAct < 0) return null;
    return s.players[s.toAct]!.isBot ? null : new Date(Date.now() + TURN_MS).toISOString();
  };

  const persist = (id: number, s: TableState, status?: string) =>
    db.from('poker_tables')
      .update({ state: s, turn_deadline: deadlineFor(s), updated_at: new Date().toISOString(), ...(status ? { status } : {}) })
      .eq('id', id);

  const loadByMembership = async (tableId?: number): Promise<Row | null> => {
    // Always restrict to tables the caller is actually a member of — even when a
    // tableId is supplied — so a non-member can't load (and act on / time out)
    // another table's players by guessing a sequential id.
    const memberOf = (await db.from('poker_table_members').select('table_id').eq('user_id', user.id)).data?.map((m) => m.table_id) ?? [];
    if (memberOf.length === 0) return null;
    let q = db.from('poker_tables')
      .select('id, host_id, status, buy_in, state, turn_deadline')
      .neq('status', 'closed')
      .in('id', memberOf);
    if (tableId != null) q = q.eq('id', tableId);
    const { data } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
    return data as Row | null;
  };

  // Auto-fold a player who blew their turn timer (lazy enforcement).
  const enforceTimeout = (row: Row): TableState => {
    let s = row.state;
    if (row.turn_deadline && Date.now() > Date.parse(row.turn_deadline) && !s.handOver && s.toAct >= 0) {
      const actor = s.players[s.toAct]!;
      if (!actor.isBot) s = applyActionFor(s, actor.id, 'fold', 0, rand);
    }
    return s;
  };

  switch (body.op) {
    case 'create': {
      const buyIn = Math.floor(Number(body.buyIn));
      if (!Number.isInteger(buyIn) || buyIn < 100 || buyIn > 1_000_000_000) return json({ error: 'invalid buy-in' }, 400);
      const { error: debit } = await db.rpc('apply_ledger_entry', {
        p_user_id: user.id, p_type: 'bet', p_amount: -buyIn, p_game: 'poker', p_note: 'poker table buy-in', p_idempotency_key: null, p_wager: buyIn,
      });
      if (debit) return json({ error: 'insufficient balance' }, 400);

      const state = createMultiTable();
      addPlayer(state, { id: user.id, name: await name(), isBot: false, difficulty: 'medium', stack: buyIn });
      const code = genCode();
      const { data: row, error } = await db.from('poker_tables')
        .insert({ code, host_id: user.id, buy_in: buyIn, state }).select('id').single();
      if (error) return json({ error: 'could not create table' }, 500);
      await db.from('poker_table_members').insert({ table_id: row.id, user_id: user.id });
      return json({ table_id: row.id, code, view: viewFor(state, user.id) });
    }

    case 'join': {
      const code = String(body.code ?? '').toUpperCase().trim();
      const { data: row } = await db.from('poker_tables')
        .select('id, host_id, status, buy_in, state').eq('code', code).neq('status', 'closed').maybeSingle();
      if (!row) return json({ error: 'table not found' }, 404);
      const state = row.state as TableState;
      if (state.players.some((p) => p.id === user.id)) return json({ table_id: row.id, view: viewFor(state, user.id) });
      if (!state.handOver) return json({ error: 'hand in progress — try again shortly' }, 409);
      if (state.players.length >= 9) return json({ error: 'table full' }, 409);

      const { error: debit } = await db.rpc('apply_ledger_entry', {
        p_user_id: user.id, p_type: 'bet', p_amount: -row.buy_in, p_game: 'poker', p_note: 'poker table buy-in', p_idempotency_key: null, p_wager: row.buy_in,
      });
      if (debit) return json({ error: 'insufficient balance' }, 400);
      addPlayer(state, { id: user.id, name: await name(), isBot: false, difficulty: 'medium', stack: row.buy_in });
      await persist(row.id, state);
      await db.from('poker_table_members').upsert({ table_id: row.id, user_id: user.id });
      return json({ table_id: row.id, view: viewFor(state, user.id) });
    }

    case 'add_bot': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      if (row.host_id !== user.id) return json({ error: 'host only' }, 403);
      const difficulty = (['easy', 'medium', 'hard'].includes(String(body.difficulty)) ? body.difficulty : 'medium') as BotDifficulty;
      const botId = `bot_${crypto.randomUUID().slice(0, 6)}`;
      const n = row.state.players.filter((p) => p.isBot).length + 1;
      const ok = addPlayer(row.state, { id: botId, name: `Bot ${n}`, isBot: true, difficulty, stack: row.buy_in });
      if (!ok) return json({ error: 'cannot add bot now' }, 409);
      await persist(row.id, row.state);
      return json({ view: viewFor(row.state, user.id) });
    }

    case 'start': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      if (row.host_id !== user.id) return json({ error: 'host only' }, 403);
      if (row.state.players.length < 2) return json({ error: 'need at least 2 players' }, 409);
      const state = startHand(row.state, rand);
      await persist(row.id, state, 'active');
      return json({ view: viewFor(state, user.id) });
    }

    case 'act': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      let state = enforceTimeout(row);
      const action = String(body.action) as PokerAction;
      if (['fold', 'check', 'call', 'raise'].includes(action)) {
        state = applyActionFor(state, user.id, action, Math.floor(Number(body.raiseTo) || 0), rand);
      }
      await persist(row.id, state);
      return json({ view: viewFor(state, user.id) });
    }

    case 'deal': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      if (!row.state.handOver) return json({ error: 'hand in progress' }, 409);
      const state = startHand(row.state, rand);
      await persist(row.id, state, 'active');
      return json({ view: viewFor(state, user.id) });
    }

    case 'leave': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      const state = row.state;
      const me = state.players.find((p) => p.id === user.id);
      if (me && !state.handOver) {
        const cashOut = me.stack;
        if (cashOut > 0) {
          await db.rpc('apply_ledger_entry', {
            p_user_id: user.id, p_type: 'win', p_amount: cashOut, p_game: 'poker', p_note: 'poker table cash-out', p_idempotency_key: null, p_wager: 0,
          });
        }
        removePlayer(state, user.id);
      } else if (me) {
        return json({ error: 'finish the hand before leaving' }, 409);
      }
      await db.from('poker_table_members').delete().eq('table_id', row.id).eq('user_id', user.id);
      const remaining = state.players.filter((p) => !p.isBot).length;
      await persist(row.id, state, remaining === 0 ? 'closed' : undefined);
      return json({ left: true });
    }

    case 'state': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ view: null });
      const state = enforceTimeout(row);
      if (state !== row.state) await persist(row.id, state);
      return json({ view: viewFor(state, user.id), host: row.host_id === user.id });
    }

    default:
      return json({ error: 'unknown op' }, 400);
  }
});
