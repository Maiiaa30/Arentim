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
  let body: { op?: string; code?: string; buyIn?: number; botCount?: number; difficulty?: string; action?: string; raiseTo?: number; tableId?: number; amount?: number; isPublic?: boolean; targetId?: string };
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

  // Remove a seat safely whether or not a hand is in progress: mid-hand, fold the
  // player (their committed chips stay in the pot, conserved) and flag the seat to
  // be purged at the next hand; between hands they can be removed outright. If it
  // was their turn, fold through the engine so the hand keeps progressing.
  const foldSeat = (state: TableState, id: string): TableState => {
    if (state.handOver) return state;
    if (state.toAct >= 0 && state.players[state.toAct]!.id === id) {
      return applyActionFor(state, id, 'fold', 0, rand);
    }
    const p = state.players.find((pp) => pp.id === id);
    if (p && (p.status === 'active' || p.status === 'allin')) p.status = 'folded';
    return state;
  };

  // When the host leaves/is removed and other humans remain, pass the host badge
  // to one of them so add-bot / start keep working.
  const transferHostIfNeeded = async (row: Row, state: TableState, leaverId: string) => {
    if (row.host_id !== leaverId) return;
    const nextHost = state.players.find((p) => !p.isBot && !p.leaving && p.id !== leaverId);
    if (nextHost) await db.from('poker_tables').update({ host_id: nextHost.id }).eq('id', row.id);
  };

  // Between hands, broke bots leave and a fresh bot takes the seat (same
  // difficulty, a new buy-in) so the table stays full and the game keeps going.
  const rotateBrokeBots = (state: TableState, buyIn: number) => {
    if (!state.handOver) return;
    const broke = state.players.filter((p) => p.isBot && p.stack <= 0);
    for (const b of broke) {
      removePlayer(state, b.id);
      addPlayer(state, {
        id: `bot_${crypto.randomUUID().slice(0, 6)}`,
        name: randomBotName(state.players.map((p) => p.name)),
        isBot: true,
        difficulty: b.difficulty,
        stack: buyIn,
      });
    }
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
        .insert({ code, host_id: user.id, buy_in: buyIn, state, is_public: body.isPublic === true })
        .select('id').single();
      if (error) return json({ error: 'could not create table' }, 500);
      await db.from('poker_table_members').insert({ table_id: row.id, user_id: user.id });
      return json({ table_id: row.id, code, view: viewFor(state, user.id) });
    }

    case 'join': {
      // Join by code (private + public) OR by id for a public table (from the
      // lobby "Sentar"). A private table can't be joined by guessing its id.
      let row: { id: number; host_id: string; status: string; buy_in: number; state: TableState; is_public: boolean } | null = null;
      if (body.tableId != null) {
        const r = await db.from('poker_tables')
          .select('id, host_id, status, buy_in, state, is_public').eq('id', body.tableId).neq('status', 'closed').maybeSingle();
        if (r.data && r.data.is_public) row = r.data as typeof row;
      } else {
        const code = String(body.code ?? '').toUpperCase().trim();
        const r = await db.from('poker_tables')
          .select('id, host_id, status, buy_in, state, is_public').eq('code', code).neq('status', 'closed').maybeSingle();
        row = (r.data as typeof row) ?? null;
      }
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
      rotateBrokeBots(row.state, row.buy_in);
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
      rotateBrokeBots(row.state, row.buy_in);
      // A hand needs at least two seats with chips. Without this guard startHand
      // silently no-ops (handOver stays true) and the table looks frozen.
      if (row.state.players.filter((p) => p.stack > 0 && !p.leaving).length < 2) {
        return json({ error: 'need at least 2 players' }, 409);
      }
      const trail: unknown[] = [];
      const rec: StepRecorder = (st) => trail.push(viewFor(st, user.id));
      let state: TableState;
      try {
        state = startHand(row.state, rand, rec);
      } catch (e) {
        console.error('startHand failed', e);
        return json({ error: 'could not start hand' }, 500);
      }
      await persist(row.id, state, 'active');
      return json({ view: viewFor(state, user.id), trail, turnDeadline: deadlineFor(state) });
    }

    case 'rebuy': {
      // A seated human tops their stack back up from their Tostões balance —
      // only between hands. Bots are auto-replaced instead (rotateBrokeBots).
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      if (!row.state.handOver) return json({ error: 'Só podes recarregar entre mãos.' }, 409);
      const me = row.state.players.find((p) => p.id === user.id);
      if (!me || me.isBot) return json({ error: 'not seated' }, 404);
      const amount = Math.floor(Number(body.amount));
      if (!Number.isInteger(amount) || amount < 100 || amount > 1_000_000_000) return json({ error: 'invalid amount' }, 400);
      // Keep a single seat from hoarding the whole bankroll on the felt.
      if (me.stack + amount > row.buy_in * 20) return json({ error: 'Limite da mesa atingido.' }, 400);
      const { error: debit } = await db.rpc('apply_ledger_entry', {
        p_user_id: user.id, p_type: 'bet', p_amount: -amount, p_game: 'poker', p_note: 'poker table recarga', p_idempotency_key: null, p_wager: amount,
      });
      if (debit) return json({ error: 'insufficient balance' }, 400);
      me.stack += amount;
      await persist(row.id, row.state);
      return json({ view: viewFor(row.state, user.id) });
    }

    case 'leave': {
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      let state = row.state;
      const me = state.players.find((p) => p.id === user.id);
      let cashOut = 0;
      if (me) {
        // Leaving mid-hand used to be blocked ("Termine a mão antes de sair"),
        // but with bots the table is almost never between hands, so a player
        // could feel trapped. Instead, fold the leaver: chips already committed
        // to the pot stay in play and go to the eventual winner (conserved),
        // their remaining stack is cashed out now, and the seat is purged at the
        // next hand start (removePlayer is a no-op mid-hand). If it's their turn,
        // fold through the engine so the hand keeps progressing for everyone.
        state = foldSeat(state, user.id);
        const meNow = state.players.find((p) => p.id === user.id)!;
        cashOut = meNow.stack;
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
        meNow.stack = 0;
        if (state.handOver) removePlayer(state, user.id);
        else meNow.leaving = true; // purged at the next startHand
      }
      await db.from('poker_table_members').delete().eq('table_id', row.id).eq('user_id', user.id);
      await transferHostIfNeeded(row, state, user.id);
      const remaining = state.players.filter((p) => !p.isBot && !p.leaving).length;
      await persist(row.id, state, remaining === 0 ? 'closed' : undefined);
      return json({ left: true, cashOut });
    }

    case 'kick': {
      // Host removes a player or bot. A kicked human is folded (if mid-hand) and
      // their remaining stack is returned to their balance; a bot is just folded
      // + removed. Same chip-conservation rules as a normal leave.
      const row = await loadByMembership(body.tableId);
      if (!row) return json({ error: 'no table' }, 404);
      if (row.host_id !== user.id) return json({ error: 'host only' }, 403);
      const targetId = String(body.targetId ?? '');
      if (!targetId || targetId === user.id) return json({ error: 'bad request' }, 400);
      let state = row.state;
      const target = state.players.find((p) => p.id === targetId);
      if (!target) return json({ error: 'player not found' }, 404);

      state = foldSeat(state, targetId);
      const t = state.players.find((p) => p.id === targetId)!;
      if (!t.isBot && t.stack > 0) {
        const tm = (await db.from('poker_table_members').select('joined_at').eq('table_id', row.id).eq('user_id', targetId).maybeSingle()).data;
        await db.rpc('apply_ledger_entry', {
          p_user_id: targetId, p_type: 'win', p_amount: t.stack, p_game: 'poker', p_note: 'poker table expulso',
          p_idempotency_key: `poker-cashout-${row.id}-${targetId}-${tm?.joined_at ?? '0'}`, p_wager: 0,
        });
      }
      t.stack = 0;
      if (state.handOver) removePlayer(state, targetId);
      else t.leaving = true;
      if (!t.isBot) await db.from('poker_table_members').delete().eq('table_id', row.id).eq('user_id', targetId);
      await persist(row.id, state);
      return json({ view: viewFor(state, user.id), kicked: targetId });
    }

    case 'watch': {
      // Spectate a PUBLIC table by id — no membership, no buy-in. viewFor hides
      // every hole card because the watcher isn't a seated player.
      const { data: row } = await db.from('poker_tables')
        .select('id, host_id, buy_in, state, is_public, status')
        .eq('id', body.tableId ?? -1).neq('status', 'closed').maybeSingle();
      if (!row || !row.is_public) return json({ view: null });
      const state = row.state as TableState;
      const seated = state.players.filter((p) => !p.leaving).length;
      return json({
        view: viewFor(state, user.id),
        buyIn: row.buy_in,
        seatsOpen: state.handOver && seated < MAX_SEATS,
        seated,
      });
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
