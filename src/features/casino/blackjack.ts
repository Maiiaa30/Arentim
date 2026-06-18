/**
 * Blackjack — pure rules engine. The SERVER (SQL RPCs) is authoritative and
 * holds the deck; this module mirrors the rules for the UI (showing hand
 * values, which actions are legal) and is the unit-tested specification the SQL
 * is translated from.
 *
 * Cards are integers 0–51: rank = card % 13 (0 = Ace, 1 = 2 … 9 = 10,
 * 10 = J, 11 = Q, 12 = K); suit = floor(card / 13) (0♠ 1♥ 2♦ 3♣).
 */

export const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUIT_LABELS = ['♠', '♥', '♦', '♣'];

export type Outcome = 'win' | 'lose' | 'push' | 'blackjack';

export function cardRank(card: number): number {
  return card % 13;
}

export function cardSuit(card: number): number {
  return Math.floor(card / 13);
}

export function cardLabel(card: number): string {
  return `${RANK_LABELS[cardRank(card)]}${SUIT_LABELS[cardSuit(card)]}`;
}

/** Base value: Ace counts as 11 here (soft handling done in handValue). */
export function cardValue(card: number): number {
  const r = cardRank(card);
  if (r === 0) return 11; // Ace
  if (r >= 9) return 10; // 10, J, Q, K
  return r + 1; // 2–9
}

export interface HandValue {
  total: number;
  /** True when an Ace is still counted as 11 (a "soft" hand). */
  soft: boolean;
}

/** Best total ≤ 21 when possible, reducing aces from 11 to 1 as needed. */
export function handValue(cards: readonly number[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (cardRank(c) === 0) aces += 1;
    total += cardValue(c);
  }
  while (total > 21 && aces > 0) {
    total -= 10; // count one Ace as 1 instead of 11
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function isBust(cards: readonly number[]): boolean {
  return handValue(cards).total > 21;
}

/** A natural blackjack: exactly two cards totalling 21. */
export function isBlackjack(cards: readonly number[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Dealer hits while under 17 and stands on all 17s (including soft 17). */
export function dealerShouldHit(cards: readonly number[]): boolean {
  return handValue(cards).total < 17;
}

/** Two cards are splittable when their rank values are equal (e.g. any two 10s). */
export function canSplit(cards: readonly number[]): boolean {
  return cards.length === 2 && cardValue(cards[0]!) === cardValue(cards[1]!);
}

/**
 * Resolve a player hand against the dealer's final hand.
 * `playerNatural` flags a two-card 21 dealt initially (not after a split).
 */
export function settle(
  playerCards: readonly number[],
  dealerCards: readonly number[],
  playerNatural: boolean,
): Outcome {
  if (isBust(playerCards)) return 'lose';

  const dealerNatural = isBlackjack(dealerCards);
  if (playerNatural && !dealerNatural) return 'blackjack';
  if (playerNatural && dealerNatural) return 'push';

  const pv = handValue(playerCards).total;
  const dv = handValue(dealerCards).total;

  if (dv > 21) return 'win';
  if (pv > dv) return 'win';
  if (pv < dv) return 'lose';
  return 'push';
}

/**
 * Total return (stake included) for an outcome. Blackjack pays 3:2 (2.5×),
 * a win pays even money (2×), a push returns the stake, a loss returns 0.
 * Floored to whole Tostões so rounding never favours the player.
 */
export function payoutFor(outcome: Outcome, stake: number): number {
  switch (outcome) {
    case 'blackjack':
      return Math.floor(stake * 2.5);
    case 'win':
      return stake * 2;
    case 'push':
      return stake;
    case 'lose':
      return 0;
  }
}
