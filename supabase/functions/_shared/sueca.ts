/**
 * Sueca — the Portuguese 40-card trick-taking game, 4 players in two partnerships
 * (seats 0 & 2 vs 1 & 3). Pure + deterministic (randomness injected) so it can
 * drive a single-player-vs-bots game and be unit-tested.
 *
 * Card encoding 0..39: suit*10 + rankIndex, where rankIndex orders by trick
 * strength (0 = Ás strongest … 9 = 2 weakest): A,7,K,J,Q,6,5,4,3,2.
 * Points: A=11, 7=10, K=4, J(Valete)=3, Q(Dama)=2, others 0 → 120 total.
 */

export const RANK_LABELS = ['A', '7', 'K', 'J', 'Q', '6', '5', '4', '3', '2'] as const;
export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'] as const;
const POINTS = [11, 10, 4, 3, 2, 0, 0, 0, 0, 0];

export const suitOf = (c: number) => Math.floor(c / 10);
export const rankOf = (c: number) => c % 10; // rankIndex; lower = stronger
export const cardPoints = (c: number) => POINTS[rankOf(c)]!;
export const cardLabel = (c: number) => RANK_LABELS[rankOf(c)]!;
export const teamOf = (p: number) => p % 2;

export type Rand = () => number;
export type Played = { player: number; card: number };

export interface SuecaState {
  hands: number[][]; // 4 hands
  trump: number; // suit 0-3
  trumpCard: number; // card that set the trump (dealer's last)
  dealer: number;
  turn: number; // whose turn (0-3), -1 when waiting to collect
  leader: number; // who led the current trick
  trick: Played[]; // cards played this trick (0-4)
  trickComplete: boolean; // 4 cards down, awaiting collectTrick
  trickWinner: number; // winner of the just-completed trick (-1 if none)
  lastTrickWinner: number; // winner of the previous collected trick
  captured: [number, number]; // points captured per team
  tricksPlayed: number; // 0-10
  log: string[];
  done: boolean;
  result: SuecaResult | null;
  turnDeadline: string | null; // ISO — when the current human turn auto-plays (stamped by the Edge Fn)
}

export interface SuecaResult {
  teamAPoints: number;
  teamBPoints: number;
  winner: 0 | 1 | null; // winning team, or null for a 60-60 draw
  margin: 'normal' | 'dupla' | 'capote';
  games: number; // match points won (1 / 2 / 4)
}

export const makeDeck = (): number[] => Array.from({ length: 40 }, (_, i) => i);

export function shuffle(deck: number[], rand: Rand): number[] {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

/** Cards a player may legally play: must follow the led suit if able. */
export function legalMoves(hand: number[], ledSuit: number | null): number[] {
  if (ledSuit === null) return hand.slice();
  const follow = hand.filter((c) => suitOf(c) === ledSuit);
  return follow.length ? follow : hand.slice();
}

/** Does card `c` currently beat `w` given trump + led suit. */
export function beats(c: number, w: number, trump: number, led: number): boolean {
  const cT = suitOf(c) === trump;
  const wT = suitOf(w) === trump;
  if (cT && !wT) return true;
  if (!cT && wT) return false;
  if (cT && wT) return rankOf(c) < rankOf(w);
  const cL = suitOf(c) === led;
  const wL = suitOf(w) === led;
  if (cL && !wL) return true;
  if (!cL) return false;
  return rankOf(c) < rankOf(w);
}

/** Index within the trick array of the winning card. */
export function trickWinnerIndex(trick: Played[], trump: number): number {
  const led = suitOf(trick[0]!.card);
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    if (beats(trick[i]!.card, trick[best]!.card, trump, led)) best = i;
  }
  return best;
}

const clone = (s: SuecaState): SuecaState => ({
  ...s,
  hands: s.hands.map((h) => h.slice()),
  trick: s.trick.map((t) => ({ ...t })),
  captured: [s.captured[0], s.captured[1]],
  log: s.log.slice(),
  result: s.result,
});

/** Deal a fresh hand. Trump = suit of the dealer's last card; player left of the
 *  dealer leads. */
export function deal(rand: Rand, dealer: number): SuecaState {
  const deck = shuffle(makeDeck(), rand);
  const hands: number[][] = [[], [], [], []];
  for (let i = 0; i < 40; i++) hands[i % 4]!.push(deck[i]!);
  const trumpCard = hands[dealer]![hands[dealer]!.length - 1]!;
  const trump = suitOf(trumpCard);
  const leader = (dealer + 1) % 4;
  return {
    hands,
    trump,
    trumpCard,
    dealer,
    turn: leader,
    leader,
    trick: [],
    trickComplete: false,
    trickWinner: -1,
    lastTrickWinner: -1,
    captured: [0, 0],
    tricksPlayed: 0,
    log: [],
    done: false,
    result: null,
    turnDeadline: null,
  };
}

// ---- Bot AI ----------------------------------------------------------------
const weakest = (pool: number[]) => pool.reduce((a, b) => (rankOf(b) > rankOf(a) ? b : a));
const highestPoints = (pool: number[]) =>
  pool.reduce((a, b) => (cardPoints(b) > cardPoints(a) || (cardPoints(b) === cardPoints(a) && rankOf(b) < rankOf(a)) ? b : a));
const lowestValue = (pool: number[]) =>
  pool.reduce((a, b) => (cardPoints(b) < cardPoints(a) || (cardPoints(b) === cardPoints(a) && rankOf(b) > rankOf(a)) ? b : a));

/** Heuristic Sueca bot: follows suit, cuts with trump, carries points to a
 *  winning partner, and wins opponents' tricks as cheaply as possible. */
export function decideBot(s: SuecaState, p: number): number {
  const hand = s.hands[p]!;
  const trump = s.trump;
  const ledSuit = s.trick.length > 0 ? suitOf(s.trick[0]!.card) : null;
  const legal = legalMoves(hand, ledSuit);
  if (legal.length === 1) return legal[0]!;

  if (ledSuit === null) {
    const aces = legal.filter((c) => rankOf(c) === 0 && suitOf(c) !== trump);
    if (aces.length) return aces[0]!;
    const nonTrump = legal.filter((c) => suitOf(c) !== trump);
    return weakest(nonTrump.length ? nonTrump : legal);
  }

  const wi = trickWinnerIndex(s.trick, trump);
  const winningCard = s.trick[wi]!.card;
  const partnerWinning = teamOf(s.trick[wi]!.player) === teamOf(p);
  const hasLed = hand.some((c) => suitOf(c) === ledSuit);

  if (hasLed) {
    if (partnerWinning) {
      const notBeating = legal.filter((c) => !beats(c, winningCard, trump, ledSuit));
      return highestPoints(notBeating.length ? notBeating : legal);
    }
    const beating = legal.filter((c) => beats(c, winningCard, trump, ledSuit));
    if (beating.length) return weakest(beating);
    return lowestValue(legal);
  }

  // Can't follow: trump or discard.
  const trumps = legal.filter((c) => suitOf(c) === trump);
  const discards = legal.filter((c) => suitOf(c) !== trump);
  if (partnerWinning) {
    return highestPoints(discards.length ? discards : legal);
  }
  if (trumps.length) {
    const winning = trumps.filter((c) => beats(c, winningCard, trump, ledSuit));
    if (winning.length) return weakest(winning);
  }
  return lowestValue(discards.length ? discards : legal);
}

// ---- Play ------------------------------------------------------------------
/**
 * Play the current player's card. For a bot the card is chosen automatically;
 * for a human pass their chosen card (must be legal, else the state is returned
 * unchanged). When the 4th card lands the trick is marked complete — call
 * collectTrick to award it.
 */
export function playTurn(s0: SuecaState, human: number, card?: number): SuecaState {
  if (s0.done || s0.trickComplete) return s0;
  const s = clone(s0);
  const p = s.turn;
  const ledSuit = s.trick.length > 0 ? suitOf(s.trick[0]!.card) : null;
  let chosen: number;
  if (p === human) {
    if (card == null) return s0;
    if (!legalMoves(s.hands[p]!, ledSuit).includes(card)) return s0;
    chosen = card;
  } else {
    chosen = decideBot(s, p);
  }
  s.hands[p] = s.hands[p]!.filter((c) => c !== chosen);
  s.trick.push({ player: p, card: chosen });
  s.log.push(`P${p}: ${cardLabel(chosen)}${SUIT_SYMBOLS[suitOf(chosen)]}`);
  if (s.trick.length === 4) {
    s.trickComplete = true;
    s.trickWinner = s.trick[trickWinnerIndex(s.trick, s.trump)]!.player;
    s.turn = -1;
  } else {
    s.turn = (p + 1) % 4;
  }
  return s;
}

/** Award a completed trick to its winner and set up the next one (or score). */
export function collectTrick(s0: SuecaState): SuecaState {
  if (!s0.trickComplete) return s0;
  const s = clone(s0);
  const winner = s.trickWinner;
  const pts = s.trick.reduce((t, x) => t + cardPoints(x.card), 0);
  if (teamOf(winner) === 0) s.captured[0] += pts;
  else s.captured[1] += pts;
  s.tricksPlayed += 1;
  s.lastTrickWinner = winner;
  s.trick = [];
  s.trickComplete = false;
  s.trickWinner = -1;
  s.turn = winner;
  s.leader = winner;
  if (s.tricksPlayed === 10) {
    const a = s.captured[0];
    const b = s.captured[1];
    let winnerTeam: 0 | 1 | null = null;
    if (a > 60) winnerTeam = 0;
    else if (b > 60) winnerTeam = 1;
    let margin: SuecaResult['margin'] = 'normal';
    let games = 0;
    if (winnerTeam !== null) {
      const wpts = winnerTeam === 0 ? a : b;
      margin = wpts === 120 ? 'capote' : wpts >= 90 ? 'dupla' : 'normal';
      games = margin === 'capote' ? 4 : margin === 'dupla' ? 2 : 1;
    }
    s.result = { teamAPoints: a, teamBPoints: b, winner: winnerTeam, margin, games };
    s.done = true;
  }
  return s;
}
