/**
 * Balatró — pure poker-hand scoring engine. Mirrors the SQL in
 * supabase/migrations/20260625100000_balatro.sql exactly so the server (hidden
 * deck) and the client (display) agree on every number. Keep the two in lockstep.
 *
 * Card encoding 0..51: suit = card / 13 (0=♠ 1=♥ 2=♦ 3=♣),
 *   rank = card % 13 (0='2' … 8='10', 9='J', 10='Q', 11='K', 12='A').
 *
 * SCORING of a played selection:
 *   gained = (handBaseChips + Σ chipValue(played cards)) × handMult
 * where the hand type is the BEST poker hand formed by the selected cards.
 *
 * SIMPLIFICATION (must match SQL): ALL played cards contribute their chip value,
 * not only the "scoring" cards of the hand. This keeps SQL/JS trivially in sync.
 */

export type HandType =
  | 'high_card'
  | 'pair'
  | 'two_pair'
  | 'three_of_a_kind'
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'four_of_a_kind'
  | 'straight_flush';

export const HAND_TABLE: Record<HandType, { base: number; mult: number }> = {
  high_card: { base: 5, mult: 1 },
  pair: { base: 10, mult: 2 },
  two_pair: { base: 20, mult: 2 },
  three_of_a_kind: { base: 30, mult: 3 },
  straight: { base: 30, mult: 4 },
  flush: { base: 35, mult: 4 },
  full_house: { base: 40, mult: 4 },
  four_of_a_kind: { base: 60, mult: 7 },
  straight_flush: { base: 100, mult: 8 },
};

export const BALATRO_TARGET = 620;
export const BALATRO_REWARD = 2.0;
export const BALATRO_HANDS = 4;
export const BALATRO_DISCARDS = 3;

/** rank index 0..12 (0='2' … 12='A'). */
export function cardRank(card: number): number {
  return ((card % 13) + 13) % 13;
}

/** suit index 0..3 (0=♠ 1=♥ 2=♦ 3=♣). */
export function cardSuit(card: number): number {
  return Math.floor(card / 13);
}

/** Chip value: 2..10 → face, J/Q/K → 10, A → 11. rank is the 0..12 index. */
export function chipValue(rank: number): number {
  if (rank <= 8) return rank + 2; // 0..8 → 2..10
  if (rank <= 11) return 10; // J,Q,K
  return 11; // A
}

/** Does a sorted-unique rank list (0..12) form a 5-long straight (A-low or A-high)? */
function isStraight(uniqueRanks: number[]): boolean {
  if (uniqueRanks.length !== 5) return false;
  // A-low straight: A(12),2(0),3(1),4(2),5(3) → ranks {0,1,2,3,12}
  const asLow = uniqueRanks.slice().sort((a, b) => a - b);
  if (asLow[0] === 0 && asLow[1] === 1 && asLow[2] === 2 && asLow[3] === 3 && asLow[4] === 12) {
    return true;
  }
  // Normal/high straight: consecutive (A-high covered by 8,9,10,11,12 = 10,J,Q,K,A).
  for (let i = 1; i < asLow.length; i++) {
    if (asLow[i] !== asLow[i - 1]! + 1) return false;
  }
  return true;
}

/**
 * Best poker hand formed by 1–5 selected cards.
 * Straight / Flush / FullHouse / StraightFlush require exactly 5 cards.
 * Four of a Kind requires ≥4 cards.
 */
export function evaluateHand(cards: number[]): { type: HandType; base: number; mult: number } {
  const ranks = cards.map(cardRank);
  const suits = cards.map(cardSuit);
  const n = cards.length;

  // Rank multiplicities.
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const mult = Array.from(counts.values()).sort((a, b) => b - a); // descending
  const uniqueRanks = Array.from(counts.keys());

  const isFlush = n === 5 && suits.every((s) => s === suits[0]);
  const straight = n === 5 && isStraight(uniqueRanks);

  let type: HandType;
  if (straight && isFlush) {
    type = 'straight_flush';
  } else if (mult[0]! >= 4) {
    type = 'four_of_a_kind';
  } else if (mult[0] === 3 && mult[1] === 2) {
    type = 'full_house';
  } else if (isFlush) {
    type = 'flush';
  } else if (straight) {
    type = 'straight';
  } else if (mult[0] === 3) {
    type = 'three_of_a_kind';
  } else if (mult[0] === 2 && mult[1] === 2) {
    type = 'two_pair';
  } else if (mult[0] === 2) {
    type = 'pair';
  } else {
    type = 'high_card';
  }

  return { type, ...HAND_TABLE[type] };
}

/** Score a played selection using the formula above. */
export function scorePlay(cards: number[]): { type: HandType; gained: number } {
  const { type, base, mult } = evaluateHand(cards);
  let chips = base;
  for (const c of cards) chips += chipValue(cardRank(c));
  return { type, gained: chips * mult };
}

// ---- Result types (must match the jsonb the RPCs return) -------------------

export type BalatroState = {
  hand: number[];
  target: number;
  score: number;
  hands_left: number;
  discards_left: number;
  reward: number;
  status: 'playing';
};

export type BalatroPlayResult = {
  hand_type: string;
  gained: number;
  score: number;
  hands_left: number;
  discards_left: number;
  played: number[];
  hand: number[];
  status: 'playing' | 'won' | 'lost';
  payout: number;
  balance: number;
};

export type BalatroDiscardResult = {
  hand: number[];
  score: number;
  target: number;
  hands_left: number;
  discards_left: number;
  status: 'playing';
  balance: number;
};
