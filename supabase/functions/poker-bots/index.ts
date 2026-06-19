// Supabase Edge Function: poker-bots
//
// Server-authoritative single-player-vs-bots Texas Hold'em. Holds the deck and
// bot hole cards in public.poker_bot_tables; the client only ever receives a
// sanitized view. Money flows through the atomic apply_ledger_entry RPC: a
// buy-in debit on `sit`, a credit of the remaining stack on `leave`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  applyAction,
  createTable,
  startHand,
  viewFor,
  type TableState,
} from '../_shared/pokerTable.ts';
import type { BotDifficulty, PokerAction } from '../_shared/poker.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await userClient.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: { op?: string; buyIn?: number; botCount?: number; difficulty?: string; action?: string; raiseTo?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }

  const loadActive = async () => {
    const { data } = await db
      .from('poker_bot_tables')
      .select('id, state')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    return data as { id: number; state: TableState } | null;
  };
  const save = (id: number, state: TableState) =>
    db.from('poker_bot_tables').update({ state, updated_at: new Date().toISOString() }).eq('id', id);

  switch (body.op) {
    case 'state': {
      const t = await loadActive();
      return json({ view: t ? viewFor(t.state, 'you') : null });
    }

    case 'sit': {
      const buyIn = Math.floor(Number(body.buyIn));
      const botCount = Math.min(5, Math.max(1, Math.floor(Number(body.botCount) || 1)));
      const difficulty = (['easy', 'medium', 'hard'].includes(String(body.difficulty))
        ? body.difficulty
        : 'medium') as BotDifficulty;
      if (!Number.isInteger(buyIn) || buyIn < 100 || buyIn > 1_000_000_000) {
        return json({ error: 'invalid buy-in' }, 400);
      }
      if (await loadActive()) return json({ error: 'leave your current table first' }, 409);

      const { error: debitErr } = await db.rpc('apply_ledger_entry', {
        p_user_id: user.id, p_type: 'bet', p_amount: -buyIn, p_game: 'poker',
        p_note: 'poker buy-in', p_idempotency_key: null, p_wager: buyIn,
      });
      if (debitErr) return json({ error: 'insufficient balance' }, 400);

      const { data: profile } = await db.from('profiles').select('display_name').eq('id', user.id).single();
      const seatName = profile?.display_name ?? 'You';
      const botList = Array.from({ length: botCount }, (_, i) => ({ name: `Bot ${i + 1}`, difficulty }));
      let state = createTable(seatName, buyIn, botList);
      state.players[0]!.id = 'you';
      state = startHand(state, rand);

      const { data: row, error } = await db
        .from('poker_bot_tables')
        .insert({ user_id: user.id, buy_in: buyIn, state })
        .select('id')
        .single();
      if (error) return json({ error: 'could not create table' }, 500);
      return json({ view: viewFor(state, 'you'), table_id: row.id });
    }

    case 'act': {
      const t = await loadActive();
      if (!t) return json({ error: 'no active table' }, 404);
      const action = String(body.action) as PokerAction;
      if (!['fold', 'check', 'call', 'raise'].includes(action)) return json({ error: 'bad action' }, 400);
      const state = applyAction(t.state, action, Math.floor(Number(body.raiseTo) || 0), rand);
      await save(t.id, state);
      return json({ view: viewFor(state, 'you') });
    }

    case 'deal': {
      const t = await loadActive();
      if (!t) return json({ error: 'no active table' }, 404);
      if (!t.state.handOver) return json({ error: 'hand in progress' }, 409);
      const state = startHand(t.state, rand);
      await save(t.id, state);
      return json({ view: viewFor(state, 'you') });
    }

    case 'leave': {
      const t = await loadActive();
      if (!t) return json({ error: 'no active table' }, 404);
      const you = t.state.players.find((p) => p.id === 'you');
      const cashOut = you?.stack ?? 0;
      if (cashOut > 0) {
        await db.rpc('apply_ledger_entry', {
          p_user_id: user.id, p_type: 'win', p_amount: cashOut, p_game: 'poker',
          p_note: 'poker cash-out', p_idempotency_key: null, p_wager: 0,
        });
      }
      await db.from('poker_bot_tables').update({ status: 'closed', state: t.state }).eq('id', t.id);
      return json({ left: true, cashOut });
    }

    default:
      return json({ error: 'unknown op' }, 400);
  }
});
