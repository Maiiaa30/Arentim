/**
 * Texas Hold'em table state machine — pure and deterministic (all randomness is
 * injected). Drives a single-player-vs-bots cash game: post blinds, deal, run
 * four betting streets with auto-played bots, and award the pot (with correct
 * side pots) at showdown. The Edge Function persists the returned state and
 * exposes only a sanitized view to the client; this module never touches money
 * or the network.
 */
import {
  type BotDifficulty,
  type PokerAction,
  decideBot,
  evaluate,
  compareScores,
  handName,
  makeDeck,
  shuffle,
} from './poker.ts';

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  difficulty: BotDifficulty;
  stack: number;
  hole: number[];
  committed: number; // chips in for the current street
  totalCommitted: number; // chips in for the whole hand (for side pots)
  status: 'active' | 'folded' | 'allin' | 'out';
  hasActed: boolean; // acted since the last raise this street
  /** Set when a player leaves mid-hand: they are folded + cashed out now and the
   *  seat is purged at the next hand start (removePlayer is a no-op mid-hand). */
  leaving?: boolean;
}

export type Street = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface TableState {
  players: Player[];
  button: number;
  deck: number[];
  community: number[];
  street: Street;
  pot: number;
  currentBet: number; // highest committed this street
  minRaise: number; // minimum raise increment
  toAct: number; // index whose turn it is (-1 when none)
  smallBlind: number;
  bigBlind: number;
  handOver: boolean;
  result: { winners: { id: string; amount: number }[]; reveal: { id: string; hole: number[]; hand: string }[] } | null;
  log: string[];
}

export type Rand = () => number; // uniform [0,1)
/**
 * Optional per-action observer. When supplied to the action helpers, it is
 * called with the mutated table after each *bot* action (and after each street's
 * cards are dealt), so the caller can capture a trail of snapshots and replay
 * them with a delay client-side — otherwise the whole hand resolves instantly.
 */
export type StepRecorder = (s: TableState) => void;
const randInt = (rand: Rand, n: number) => Math.floor(rand() * n);

function activeCount(s: TableState): number {
  return s.players.filter((p) => p.status === 'active' || p.status === 'allin').length;
}
function canActCount(s: TableState): number {
  return s.players.filter((p) => p.status === 'active').length;
}

function nextIndex(s: TableState, from: number, pred: (p: Player) => boolean): number {
  for (let i = 1; i <= s.players.length; i++) {
    const idx = (from + i) % s.players.length;
    if (pred(s.players[idx]!)) return idx;
  }
  return -1;
}

export function createTable(
  playerName: string,
  buyIn: number,
  bots: { name: string; difficulty: BotDifficulty }[],
  smallBlind = 10,
  bigBlind = 20,
): TableState {
  const players: Player[] = [
    blankPlayer('you', playerName, false, 'medium', buyIn),
    ...bots.map((b, i) => blankPlayer(`bot${i}`, b.name, true, b.difficulty, buyIn)),
  ];
  return {
    players,
    button: 0,
    deck: [],
    community: [],
    street: 'idle',
    pot: 0,
    currentBet: 0,
    minRaise: bigBlind,
    toAct: -1,
    smallBlind,
    bigBlind,
    handOver: true,
    result: null,
    log: [],
  };
}

/** An empty multiplayer table; seats are added with addPlayer before the first hand. */
export function createMultiTable(smallBlind = 10, bigBlind = 20): TableState {
  return {
    players: [],
    button: 0,
    deck: [],
    community: [],
    street: 'idle',
    pot: 0,
    currentBet: 0,
    minRaise: bigBlind,
    toAct: -1,
    smallBlind,
    bigBlind,
    handOver: true,
    result: null,
    log: [],
  };
}

/** Seat a player. Only valid between hands (handOver). Returns false if full/dup. */
export function addPlayer(
  s: TableState,
  seat: { id: string; name: string; isBot: boolean; difficulty: BotDifficulty; stack: number },
): boolean {
  if (!s.handOver || s.players.length >= 9) return false;
  if (s.players.some((p) => p.id === seat.id)) return false;
  s.players.push(blankPlayer(seat.id, seat.name, seat.isBot, seat.difficulty, seat.stack));
  return true;
}

/** Remove a player between hands (e.g. a friend leaves). */
export function removePlayer(s: TableState, id: string): void {
  if (!s.handOver) return;
  s.players = s.players.filter((p) => p.id !== id);
}

function blankPlayer(
  id: string,
  name: string,
  isBot: boolean,
  difficulty: BotDifficulty,
  stack: number,
): Player {
  return { id, name, isBot, difficulty, stack, hole: [], committed: 0, totalCommitted: 0, status: 'out', hasActed: false };
}

function postBlind(s: TableState, idx: number, amount: number) {
  const p = s.players[idx]!;
  const post = Math.min(amount, p.stack);
  p.stack -= post;
  p.committed += post;
  p.totalCommitted += post;
  s.pot += post;
  if (p.stack === 0) p.status = 'allin';
  s.currentBet = Math.max(s.currentBet, p.committed);
}

/** Start a new hand. Players with chips sit in; the button moves. */
export function startHand(s: TableState, rand: Rand, rec?: StepRecorder): TableState {
  // Drop anyone who left during the previous hand (already folded + cashed out).
  if (s.players.some((p) => p.leaving)) s.players = s.players.filter((p) => !p.leaving);
  for (const p of s.players) {
    p.hole = [];
    p.committed = 0;
    p.totalCommitted = 0;
    p.hasActed = false;
    p.status = p.stack > 0 ? 'active' : 'out';
  }
  if (activeCount(s) < 2) {
    s.handOver = true;
    s.street = 'idle';
    return s;
  }

  s.deck = shuffle(makeDeck(), (n) => randInt(rand, n));
  s.community = [];
  s.pot = 0;
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.result = null;
  s.handOver = false;
  s.street = 'preflop';
  s.button = nextIndex(s, s.button, (p) => p.status === 'active');
  s.log = [];

  // Deal two hole cards to each active player.
  for (let r = 0; r < 2; r++) {
    for (const p of s.players) if (p.status === 'active') p.hole.push(s.deck.pop()!);
  }

  // Blinds: heads-up posts SB on the button; otherwise SB left of button.
  const sbIdx = nextIndex(s, s.button, (p) => p.status === 'active');
  const bbIdx = nextIndex(s, sbIdx, (p) => p.status === 'active');
  postBlind(s, sbIdx, s.smallBlind);
  postBlind(s, bbIdx, s.bigBlind);
  s.currentBet = s.bigBlind;

  s.toAct = nextIndex(s, bbIdx, (p) => p.status === 'active');
  return runBots(s, rand, rec);
}

function streetCardsDealt(s: TableState) {
  if (s.street === 'flop') s.community.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!);
  else if (s.street === 'turn' || s.street === 'river') s.community.push(s.deck.pop()!);
}

function everyoneMatched(s: TableState): boolean {
  return s.players
    .filter((p) => p.status === 'active')
    .every((p) => p.hasActed && p.committed === s.currentBet);
}

function advanceStreet(s: TableState, rand: Rand, rec?: StepRecorder): TableState {
  // Reset per-street state.
  for (const p of s.players) {
    p.committed = 0;
    p.hasActed = false;
  }
  s.currentBet = 0;
  s.minRaise = s.bigBlind;

  const order: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  s.street = order[order.indexOf(s.street) + 1]!;

  if (s.street === 'showdown' || canActCount(s) === 0) {
    return showdown(s);
  }
  streetCardsDealt(s);
  // First to act post-flop is left of the button.
  s.toAct = nextIndex(s, s.button, (p) => p.status === 'active');
  rec?.(s); // snapshot the freshly-dealt board before anyone acts
  if (s.toAct === -1) return showdown(s);
  return runBots(s, rand, rec);
}

/** Apply the single-player human's action (seat id 'you'), then progress. */
export function applyAction(
  s: TableState,
  action: PokerAction,
  raiseTo: number,
  rand: Rand,
  rec?: StepRecorder,
): TableState {
  return applyActionFor(s, s.toAct >= 0 ? s.players[s.toAct]!.id : '', action, raiseTo, rand, rec);
}

/**
 * Apply a specific seated player's action — used by multiplayer tables where any
 * of several humans may be to act. Ignored unless it is exactly that player's
 * turn and they are not a bot.
 */
export function applyActionFor(
  s: TableState,
  playerId: string,
  action: PokerAction,
  raiseTo: number,
  rand: Rand,
  rec?: StepRecorder,
): TableState {
  if (s.handOver || s.toAct < 0) return s;
  const p = s.players[s.toAct]!;
  if (p.isBot || p.id !== playerId) return s; // not this player's turn
  applyFor(s, p, action, raiseTo);
  rec?.(s); // snapshot the human's own action first
  return progress(s, rand, rec);
}

function applyFor(s: TableState, p: Player, action: PokerAction, raiseTo: number) {
  const owe = s.currentBet - p.committed;
  if (action === 'fold') {
    p.status = 'folded';
    s.log.push(`${p.name} folds`);
  } else if (action === 'check') {
    if (owe > 0) return applyFor(s, p, 'call', 0); // can't check facing a bet
    s.log.push(`${p.name} checks`);
  } else if (action === 'call') {
    const pay = Math.min(owe, p.stack);
    commit(s, p, pay);
    s.log.push(`${p.name} calls ${pay}`);
    if (p.stack === 0) p.status = 'allin';
  } else {
    // raise: raiseTo is the TOTAL this player wants committed this street.
    const target = Math.min(Math.max(raiseTo, s.currentBet + s.minRaise), p.committed + p.stack);
    const pay = target - p.committed;
    commit(s, p, pay);
    const raiseSize = p.committed - s.currentBet;
    if (raiseSize >= s.minRaise) s.minRaise = raiseSize;
    s.currentBet = Math.max(s.currentBet, p.committed);
    // A raise re-opens action for everyone else.
    for (const o of s.players) if (o.status === 'active' && o !== p) o.hasActed = false;
    s.log.push(`${p.name} ${owe > 0 ? 'raises to' : 'bets'} ${p.committed}`);
    if (p.stack === 0) p.status = 'allin';
  }
  p.hasActed = true;
}

function commit(s: TableState, p: Player, amount: number) {
  const pay = Math.min(amount, p.stack);
  p.stack -= pay;
  p.committed += pay;
  p.totalCommitted += pay;
  s.pot += pay;
}

function progress(s: TableState, rand: Rand, rec?: StepRecorder): TableState {
  // Only one player left -> they win immediately.
  if (activeCount(s) === 1) return showdown(s);

  if (everyoneMatched(s)) return advanceStreet(s, rand, rec);

  s.toAct = nextIndex(s, s.toAct, (p) => p.status === 'active');
  if (s.toAct === -1) return advanceStreet(s, rand, rec);
  return runBots(s, rand, rec);
}

/** Auto-play consecutive bot turns until it's the human's turn or the hand ends. */
function runBots(s: TableState, rand: Rand, rec?: StepRecorder): TableState {
  let guard = 0;
  while (!s.handOver && s.toAct >= 0 && s.players[s.toAct]!.isBot && guard++ < 100) {
    const p = s.players[s.toAct]!;
    const decision = decideBot({
      hole: p.hole,
      community: s.community,
      toCall: s.currentBet - p.committed,
      pot: s.pot,
      minRaise: s.minRaise,
      stack: p.stack,
      difficulty: p.difficulty,
      rand,
    });
    applyFor(s, p, decision.action, decision.action === 'raise' ? decision.amount + p.committed : 0);
    rec?.(s); // snapshot this bot's action for staged client playback
    if (activeCount(s) === 1) return showdown(s);
    if (everyoneMatched(s)) return advanceStreet(s, rand, rec);
    s.toAct = nextIndex(s, s.toAct, (pp) => pp.status === 'active');
    if (s.toAct === -1) return advanceStreet(s, rand, rec);
  }
  return s;
}

/** Deal out any missing board cards, evaluate, and award pots (incl. side pots). */
export function showdown(s: TableState): TableState {
  const contenders = s.players.filter((p) => p.status === 'active' || p.status === 'allin');

  // `credit` = chips returned to each stack (pot wins + uncalled refunds);
  // `won` = contested winnings only, for the winner banner.
  let credit: Map<string, number>;
  let won: Map<string, number>;
  let reveal: { id: string; hole: number[]; hand: string }[] = [];

  if (contenders.length <= 1) {
    // Uncontested: the lone player takes the whole pot; no cards are shown.
    credit = new Map();
    won = new Map();
    if (contenders[0]) {
      credit.set(contenders[0].id, s.pot);
      won.set(contenders[0].id, s.pot);
    }
  } else {
    // Run the board out to five cards, then evaluate and split with side pots.
    while (s.community.length < 5 && s.deck.length > 0) s.community.push(s.deck.pop()!);
    ({ credit, won } = distributePots(s, contenders));
    reveal = contenders.map((p) => ({
      id: p.id,
      hole: p.hole,
      hand: handName(evaluate([...p.hole, ...s.community])),
    }));
  }

  for (const p of s.players) {
    const c = credit.get(p.id) ?? 0;
    if (c > 0) p.stack += c;
    p.committed = 0;
  }
  s.pot = 0; // fully distributed into stacks (incl. any uncalled refunds)

  s.result = {
    winners: [...won.entries()].filter(([, a]) => a > 0).map(([id, amount]) => ({ id, amount })),
    reveal,
  };
  s.street = 'showdown';
  s.handOver = true;
  s.toAct = -1;
  return s;
}

/**
 * Award the pot using contribution layers, which yields correct side pots.
 * Each layer is contested only by players who contributed to it; the best
 * hand(s) among them split it (odd chip to the earliest seat). A top layer
 * that no remaining contender is eligible for is *uncalled* money — it is
 * refunded to whoever put it in (e.g. a folded player who over-committed beyond
 * every contender) so chips are always conserved.
 *
 * Returns `credit` (everything added back to stacks) and `won` (contested
 * winnings only — refunds are excluded so a folded player isn't shown as a
 * "winner" of their own returned chips).
 */
function distributePots(
  s: TableState,
  contenders: Player[],
): { credit: Map<string, number>; won: Map<string, number> } {
  const credit = new Map<string, number>();
  const won = new Map<string, number>();
  const contributions = s.players.map((p) => ({ id: p.id, amt: p.totalCommitted }));
  const levels = [...new Set(contributions.map((c) => c.amt).filter((a) => a > 0))].sort((a, b) => a - b);

  let prev = 0;
  const score = new Map<string, number[]>();
  for (const p of contenders) score.set(p.id, evaluate([...p.hole, ...s.community]));

  for (const level of levels) {
    const layer = level - prev;
    // Per-player contribution to THIS layer (used for refunds + the pot total).
    const layerContrib = contributions
      .map((c) => ({ id: c.id, amt: Math.min(layer, Math.max(0, c.amt - prev)) }))
      .filter((c) => c.amt > 0);
    const pot = layerContrib.reduce((t, c) => t + c.amt, 0);
    if (pot <= 0) { prev = level; continue; }

    // Eligible: contenders who contributed at least up to this level.
    const eligible = contenders.filter((p) => p.totalCommitted >= level);
    if (eligible.length > 0) {
      let best: number[] | null = null;
      for (const p of eligible) if (!best || compareScores(score.get(p.id)!, best) > 0) best = score.get(p.id)!;
      const winners = eligible.filter((p) => compareScores(score.get(p.id)!, best!) === 0);
      const share = Math.floor(pot / winners.length);
      let remainder = pot - share * winners.length;
      for (const w of winners) {
        let amt = share;
        if (remainder > 0) { amt += 1; remainder -= 1; }
        credit.set(w.id, (credit.get(w.id) ?? 0) + amt);
        won.set(w.id, (won.get(w.id) ?? 0) + amt);
      }
    } else {
      // Uncalled layer: no contender can win it. Refund to its contributors.
      for (const c of layerContrib) credit.set(c.id, (credit.get(c.id) ?? 0) + c.amt);
    }
    prev = level;
  }
  return { credit, won };
}

/** Sanitized view for a given viewer: hides other players' hole cards until showdown. */
export function viewFor(s: TableState, viewerId: string): unknown {
  const reveal = s.street === 'showdown';
  return {
    // Copy the board so point-in-time snapshots (the bot-action trail) stay
    // stable when later streets push more cards onto s.community.
    street: s.street,
    community: [...s.community],
    pot: s.pot,
    currentBet: s.currentBet,
    minRaise: s.minRaise,
    handOver: s.handOver,
    toActId: s.toAct >= 0 ? s.players[s.toAct]!.id : null,
    button: s.players[s.button]?.id ?? null,
    result: s.result,
    log: s.log.slice(-8),
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      stack: p.stack,
      committed: p.committed,
      status: p.status,
      hole: p.id === viewerId || (reveal && (p.status === 'active' || p.status === 'allin')) ? p.hole : p.hole.map(() => -1),
    })),
  };
}
