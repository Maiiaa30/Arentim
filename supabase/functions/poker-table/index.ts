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
import type { StepRecorder } from '../_shared/pokerTable.ts';
import type { BotDifficulty, PokerAction } from '../_shared/poker.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { randomBotName } from '../_shared/botNames.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TURN_MS = 30_000;
const MAX_SEATS = 9; // table capacity (mirrors addPlayer's cap)

const isDifficulty = (d: unknown): d is BotDifficulty =>
  d === 'easy' || d === 'medium' || d === 'hard';

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

type Row = { id: number; host_id: string; status: string; buy_in: number; state: TableState; turn_deadline: string | null; joinedAt?: string | null };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: auth } = await userClient.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: { op?: string; code?: string; buyIn?: number; botCount?: number; difficulty?: string; action?: string; raiseTo?: number; tableId?: number };
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
    const members = (await db.from('poker_table_members').select('table_id, joined_at').eq('user_id', user.id)).data ?? [];
    if (members.length === 0) return null;
    let q = db.from('poker_tables')
      .select('id, host_id, status, buy_in, state, turn_deadline')
      .neq('status', 'closed')
      .in('id', members.map((m) => m.table_id));
    if (tableId != null) q = q.eq('id', tableId);
    const { data } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (!data) return null;
    // Capture this seat's join timestamp here (while membership is guaranteed to
    // exist) so a concurrent leave can't race it away before we build the
    // cash-out idempotency key.
    (data as Row).joinedAt = members.find((m) => m.table_id === (data as Row).id)?.joined_at ?? null;
    return data as Row;
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

      // Seat the host, then fill the requested number of bot seats up front so
      // the host isn't forced to add them one at a time. When botCount is omitted
      // (older clients) we seat none and keep the manual "add bot" flow.
      const difficulty: BotDifficulty = isDifficulty(body.difficulty) ? body.difficulty : 'medium';
      const requested = Number.isFinite(Number(body.botCount)) ? Math.floor(Number(body.botCount)) : 0;
      const botCount = Math.min(MAX_SEATS - 1, Math.max(0, requested));

      const state = createMultiTable();
      const hostName = await name();
      addPlayer(state, { id: user.id, name: hostName, isBot: false, difficulty: 'medium', stack: buyIn });
      const taken = [hostName];
      for (let i = 0; i < botCount; i++) {
        const botName = randomBotName(taken);
        taken.push(botName);
        addPlayer(state, { id: `bot_${crypto.randomUUID().slice(0, 6)}`, name: botName, isBot: true, difficulty, stack: buyIn });
      }
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
      const botName = randomBotName(row.state.players.map((p) => p.name));
      const ok = addPlayer(row.state, { id: botId, name: botName, isBot: true, difficulty, stack: row.buy_in });
      if (!ok) return json({ error: 'cannot add bot now' }, 409);
      await persist(row.id, row.state);
      return json({ view: viewFor(row.state, user.id) });
    }

    case 'start': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      if (row.host_id !== user.id) return json({ error: 'host only' }, 403);
      if (row.state.players.length < 2) return json({ error: 'need at least 2 players' }, 409);
      const trail: unknown[] = [];
      const rec: StepRecorder = (st) => trail.push(viewFor(st, user.id));
      const state = startHand(row.state, rand, rec);
      await persist(row.id, state, 'active');
      return json({ view: viewFor(state, user.id), trail, turnDeadline: deadlineFor(state) });
    }

    case 'act': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      let state = enforceTimeout(row);
      const action = String(body.action) as PokerAction;
      const trail: unknown[] = [];
      const rec: StepRecorder = (st) => trail.push(viewFor(st, user.id));
      if (['fold', 'check', 'call', 'raise'].includes(action)) {
        state = applyActionFor(state, user.id, action, Math.floor(Number(body.raiseTo) || 0), rand, rec);
      }
      await persist(row.id, state);
      return json({ view: viewFor(state, user.id), trail, turnDeadline: deadlineFor(state) });
    }

    case 'deal': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      if (!row.state.handOver) return json({ error: 'hand in progress' }, 409);
      const trail: unknown[] = [];
      const rec: StepRecorder = (st) => trail.push(viewFor(st, user.id));
      const state = startHand(row.state, rand, rec);
      await persist(row.id, state, 'active');
      return json({ view: viewFor(state, user.id), trail, turnDeadline: deadlineFor(state) });
    }

    case 'leave': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      const state = row.state;
      const me = state.players.find((p) => p.id === user.id);
      let cashOut = 0;
      if (me) {
        // You can only leave between hands; mid-hand you must finish first (else
        // removePlayer is a no-op and your cashed-out chips would be paid twice).
        if (!state.handOver) {
          return json({ error: 'Termine a mão antes de sair da mesa.' }, 409);
        }
        cashOut = me.stack;
        if (cashOut > 0) {
          // Idempotency keyed to this seat-session (table + user + join time, the
          // latter unique per re-join) so two concurrent `leave` requests can't
          // double-credit the stack, while a later legitimate re-join can still
          // cash out (different join time → different key).
          await db.rpc('apply_ledger_entry', {
            p_user_id: user.id, p_type: 'win', p_amount: cashOut, p_game: 'poker', p_note: 'poker table cash-out',
            p_idempotency_key: `poker-cashout-${row.id}-${user.id}-${row.joinedAt ?? '0'}`, p_wager: 0,
          });
        }
        removePlayer(state, user.id);
      }
      await db.from('poker_table_members').delete().eq('table_id', row.id).eq('user_id', user.id);
      const remaining = state.players.filter((p) => !p.isBot).length;
      await persist(row.id, state, remaining === 0 ? 'closed' : undefined);
      return json({ left: true, cashOut });
    }

    case 'state': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ view: null });
      const state = enforceTimeout(row);
      // Keep the stored deadline so the client countdown stays stable across
      // polls; only recompute when the timeout sweep actually changed the turn.
      let deadline = row.turn_deadline;
      if (state !== row.state) {
        await persist(row.id, state);
        deadline = deadlineFor(state);
      }
      return json({ view: viewFor(state, user.id), host: row.host_id === user.id, turnDeadline: deadline });
    }

    default:
      return json({ error: 'unknown op' }, 400);
  }
});
