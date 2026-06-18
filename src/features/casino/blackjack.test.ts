import { describe, it, expect } from 'vitest';
import {
  cardValue,
  handValue,
  isBust,
  isBlackjack,
  dealerShouldHit,
  canSplit,
  settle,
  payoutFor,
} from './blackjack';

// Helpers to build cards by rank (suit 0). rank: 0=A,1=2..9=10,10=J,11=Q,12=K
const c = (rank: number, suit = 0) => suit * 13 + rank;
const ACE = 0;
const KING = 12;
const SEVEN = 6; // value 7
const SIX = 5; // value 6
const NINE = 8; // value 9
const TEN = 9; // value 10

describe('card and hand values', () => {
  it('values aces as 11 and faces as 10', () => {
    expect(cardValue(c(ACE))).toBe(11);
    expect(cardValue(c(KING))).toBe(10);
    expect(cardValue(c(TEN))).toBe(10);
    expect(cardValue(c(SEVEN))).toBe(7);
  });

  it('counts a soft hand then hardens it when needed', () => {
    expect(handValue([c(ACE), c(SIX)])).toEqual({ total: 17, soft: true });
    // A + 6 + 10 would be 27 soft -> harden ace -> 17 hard
    expect(handValue([c(ACE), c(SIX), c(TEN)])).toEqual({ total: 17, soft: false });
    // Two aces: 11 + 1 = 12 soft
    expect(handValue([c(ACE), c(ACE)])).toEqual({ total: 12, soft: true });
  });

  it('detects bust and blackjack', () => {
    expect(isBust([c(KING), c(NINE), c(SEVEN)])).toBe(true); // 26
    expect(isBust([c(KING), c(NINE)])).toBe(false); // 19
    expect(isBlackjack([c(ACE), c(KING)])).toBe(true);
    // A + 6 + 4 = 21 across three cards is 21, but NOT a natural blackjack.
    expect(handValue([c(ACE), c(SIX), c(3)]).total).toBe(21);
    expect(isBlackjack([c(ACE), c(SIX), c(3)])).toBe(false);
  });
});

describe('dealer policy (stands on all 17)', () => {
  it('hits below 17, stands at 17+ including soft 17', () => {
    expect(dealerShouldHit([c(KING), c(SIX)])).toBe(true); // 16
    expect(dealerShouldHit([c(KING), c(SEVEN)])).toBe(false); // 17 hard
    expect(dealerShouldHit([c(ACE), c(SIX)])).toBe(false); // soft 17 -> stand
  });
});

describe('canSplit', () => {
  it('splits equal-value pairs only', () => {
    expect(canSplit([c(KING), c(TEN)])).toBe(true); // both value 10
    expect(canSplit([c(ACE), c(ACE)])).toBe(true);
    expect(canSplit([c(NINE), c(TEN)])).toBe(false);
    expect(canSplit([c(KING), c(TEN), c(ACE)])).toBe(false); // 3 cards
  });
});

describe('settle', () => {
  const dealer19 = [c(KING), c(NINE)];
  it('player bust loses regardless of dealer', () => {
    expect(settle([c(KING), c(NINE), c(SEVEN)], dealer19, false)).toBe('lose');
  });
  it('natural blackjack beats a non-natural dealer', () => {
    expect(settle([c(ACE), c(KING)], dealer19, true)).toBe('blackjack');
  });
  it('two naturals push', () => {
    expect(settle([c(ACE), c(KING)], [c(ACE), c(TEN)], true)).toBe('push');
  });
  it('higher total wins, lower loses, equal pushes', () => {
    expect(settle([c(KING), c(KING)], dealer19, false)).toBe('win'); // 20 vs 19
    expect(settle([c(KING), c(SEVEN)], dealer19, false)).toBe('lose'); // 17 vs 19
    expect(settle([c(KING), c(NINE)], dealer19, false)).toBe('push'); // 19 vs 19
  });
  it('dealer bust makes a standing player win', () => {
    expect(settle([c(KING), c(SEVEN)], [c(KING), c(SIX), c(KING)], false)).toBe('win');
  });
});

describe('payoutFor', () => {
  it('pays blackjack 3:2, win even money, push returns stake', () => {
    expect(payoutFor('blackjack', 100)).toBe(250);
    expect(payoutFor('blackjack', 50)).toBe(125);
    expect(payoutFor('blackjack', 25)).toBe(62); // 62.5 floored
    expect(payoutFor('win', 100)).toBe(200);
    expect(payoutFor('push', 100)).toBe(100);
    expect(payoutFor('lose', 100)).toBe(0);
  });
});
