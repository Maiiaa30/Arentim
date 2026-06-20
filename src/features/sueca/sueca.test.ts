import { describe, it, expect } from 'vitest';
import {
  deal,
  legalMoves,
  beats,
  trickWinnerIndex,
  playTurn,
  collectTrick,
  cardPoints,
  suitOf,
  makeDeck,
  type SuecaState,
} from './sueca';

// Deterministic LCG so tests are reproducible.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('sueca deck + deal', () => {
  it('deck has 40 unique cards totalling 120 points', () => {
    const deck = makeDeck();
    expect(new Set(deck).size).toBe(40);
    expect(deck.reduce((t, c) => t + cardPoints(c), 0)).toBe(120);
  });
  it('deals 10 cards to each seat and sets trump from the dealer', () => {
    const s = deal(lcg(1), 3);
    expect(s.hands.every((h) => h.length === 10)).toBe(true);
    expect(s.hands.flat()).toHaveLength(40);
    expect(s.trump).toBe(suitOf(s.trumpCard));
    expect(s.leader).toBe(0); // left of dealer 3
  });
});

describe('trick rules', () => {
  it('enforces following the led suit', () => {
    const hand = [0, 1, 12, 23]; // suits: 0,0,1,2
    expect(legalMoves(hand, 0)).toEqual([0, 1]); // must follow suit 0
    expect(legalMoves(hand, 3).sort((a, b) => a - b)).toEqual([0, 1, 12, 23]); // none of suit 3 → free
    expect(legalMoves(hand, null)).toHaveLength(4); // leading → free
  });
  it('trump beats a higher off-suit card', () => {
    // led suit 0 with an Ace (rankIndex 0); a low trump (suit 1) still wins.
    const trick = [
      { player: 0, card: 0 }, // A of suit 0 (led)
      { player: 1, card: 19 }, // 2 of suit 1 (trump)
    ];
    expect(beats(19, 0, 1, 0)).toBe(true);
    expect(trickWinnerIndex(trick, 1)).toBe(1);
  });
  it('highest of led suit wins when no trump is played', () => {
    const trick = [
      { player: 0, card: 5 }, // 6 of suit 0
      { player: 1, card: 0 }, // A of suit 0
      { player: 2, card: 19 }, // 2 of suit 1 (not trump here)
    ];
    expect(trickWinnerIndex(trick, 3)).toBe(1); // the Ace
  });
});

describe('a full game', () => {
  it('plays 10 legal tricks and the captured points total 120', () => {
    let s: SuecaState = deal(lcg(42), 3);
    let guard = 0;
    while (!s.done && guard++ < 100) {
      if (s.trickComplete) { s = collectTrick(s); continue; }
      // drive everyone (including seat 0) with the bot policy via playTurn
      s = playTurn(s, -1); // human = -1 → all seats auto-play
    }
    expect(s.done).toBe(true);
    expect(s.tricksPlayed).toBe(10);
    expect(s.captured[0] + s.captured[1]).toBe(120);
    expect(s.result).not.toBeNull();
    expect(s.hands.every((h) => h.length === 0)).toBe(true);
  });
});
