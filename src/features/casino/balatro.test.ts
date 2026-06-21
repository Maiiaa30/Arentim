import { describe, it, expect } from 'vitest';
import {
  evaluateHand,
  scorePlay,
  chipValue,
  cardRank,
  cardSuit,
  HAND_TABLE,
  BALATRO_TARGET,
  BALATRO_HANDS,
  BALATRO_DISCARDS,
  type HandType,
} from './balatro';

// rank index 0..12 (0='2' … 12='A'); suit 0..3. Build a card code from them.
function card(rank: number, suit: number): number {
  return suit * 13 + rank;
}
// Convenience: rank labels → index. No index-signature annotation, so each
// access is a known property typed `number` (not `number | undefined` under
// noUncheckedIndexedAccess).
const R = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8,
  J: 9, Q: 10, K: 11, A: 12,
};

describe('card helpers', () => {
  it('decodes suit and rank from a code', () => {
    expect(cardSuit(0)).toBe(0); // ♠ 2
    expect(cardRank(0)).toBe(0);
    expect(cardSuit(51)).toBe(3); // ♣ A
    expect(cardRank(51)).toBe(12);
    expect(cardSuit(13)).toBe(1); // ♥ 2
    expect(cardRank(13)).toBe(0);
  });

  it('chipValue: 2..10 face, J/Q/K=10, A=11', () => {
    expect(chipValue(R['2'])).toBe(2);
    expect(chipValue(R['9'])).toBe(9);
    expect(chipValue(R['10'])).toBe(10);
    expect(chipValue(R.J)).toBe(10);
    expect(chipValue(R.Q)).toBe(10);
    expect(chipValue(R.K)).toBe(10);
    expect(chipValue(R.A)).toBe(11);
  });
});

describe('evaluateHand', () => {
  const t = (cards: number[]): HandType => evaluateHand(cards).type;

  it('high card', () => {
    expect(t([card(R['2'], 0), card(R['7'], 1), card(R['9'], 2), card(R.J, 3), card(R.K, 0)])).toBe('high_card');
    expect(t([card(R.A, 0)])).toBe('high_card');
  });

  it('pair vs two pair', () => {
    expect(t([card(R['7'], 0), card(R['7'], 1)])).toBe('pair');
    expect(t([card(R['7'], 0), card(R['7'], 1), card(R.K, 2)])).toBe('pair');
    expect(t([card(R['7'], 0), card(R['7'], 1), card(R.K, 2), card(R.K, 3)])).toBe('two_pair');
    expect(t([card(R['7'], 0), card(R['7'], 1), card(R.K, 2), card(R.K, 3), card(R['2'], 0)])).toBe('two_pair');
  });

  it('three of a kind vs full house', () => {
    expect(t([card(R['9'], 0), card(R['9'], 1), card(R['9'], 2)])).toBe('three_of_a_kind');
    expect(t([card(R['9'], 0), card(R['9'], 1), card(R['9'], 2), card(R['2'], 3)])).toBe('three_of_a_kind');
    expect(
      t([card(R['9'], 0), card(R['9'], 1), card(R['9'], 2), card(R.K, 3), card(R.K, 0)]),
    ).toBe('full_house');
  });

  it('four of a kind (≥4 cards)', () => {
    expect(t([card(R['9'], 0), card(R['9'], 1), card(R['9'], 2), card(R['9'], 3)])).toBe('four_of_a_kind');
    expect(
      t([card(R['9'], 0), card(R['9'], 1), card(R['9'], 2), card(R['9'], 3), card(R['2'], 0)]),
    ).toBe('four_of_a_kind');
  });

  it('straight (mixed suits, exactly 5)', () => {
    expect(t([card(R['5'], 0), card(R['6'], 1), card(R['7'], 2), card(R['8'], 3), card(R['9'], 0)])).toBe('straight');
  });

  it('A-low straight A,2,3,4,5', () => {
    expect(t([card(R.A, 0), card(R['2'], 1), card(R['3'], 2), card(R['4'], 3), card(R['5'], 0)])).toBe('straight');
  });

  it('A-high straight 10,J,Q,K,A', () => {
    expect(t([card(R['10'], 0), card(R.J, 1), card(R.Q, 2), card(R.K, 3), card(R.A, 0)])).toBe('straight');
  });

  it('not a straight: K,A,2,3,4 wraparound', () => {
    expect(t([card(R.K, 0), card(R.A, 1), card(R['2'], 2), card(R['3'], 3), card(R['4'], 0)])).not.toBe('straight');
  });

  it('flush (5 same suit, not consecutive)', () => {
    expect(t([card(R['2'], 1), card(R['7'], 1), card(R['9'], 1), card(R.J, 1), card(R.K, 1)])).toBe('flush');
  });

  it('four cards same suit is NOT a flush (needs 5)', () => {
    expect(t([card(R['2'], 1), card(R['7'], 1), card(R['9'], 1), card(R.J, 1)])).toBe('high_card');
  });

  it('straight flush', () => {
    expect(t([card(R['5'], 2), card(R['6'], 2), card(R['7'], 2), card(R['8'], 2), card(R['9'], 2)])).toBe('straight_flush');
  });

  it('A-low straight flush', () => {
    expect(t([card(R.A, 3), card(R['2'], 3), card(R['3'], 3), card(R['4'], 3), card(R['5'], 3)])).toBe('straight_flush');
  });
});

describe('scorePlay', () => {
  it('pair of 7s: (10 + 7 + 7) × 2 = 48', () => {
    const r = scorePlay([card(R['7'], 0), card(R['7'], 1)]);
    expect(r.type).toBe('pair');
    expect(r.gained).toBe((HAND_TABLE.pair.base + 7 + 7) * HAND_TABLE.pair.mult);
    expect(r.gained).toBe(48);
  });

  it('high card single A: (5 + 11) × 1 = 16', () => {
    expect(scorePlay([card(R.A, 0)]).gained).toBe(16);
  });

  it('flush 2,7,9,J,K ♥: (35 + 2+7+9+10+10) × 4 = 292', () => {
    const r = scorePlay([card(R['2'], 1), card(R['7'], 1), card(R['9'], 1), card(R.J, 1), card(R.K, 1)]);
    expect(r.type).toBe('flush');
    expect(r.gained).toBe((35 + 2 + 7 + 9 + 10 + 10) * 4);
    expect(r.gained).toBe(292);
  });

  it('straight flush 5-9 ♦: (100 + 5+6+7+8+9) × 8 = 1080', () => {
    const r = scorePlay([card(R['5'], 2), card(R['6'], 2), card(R['7'], 2), card(R['8'], 2), card(R['9'], 2)]);
    expect(r.type).toBe('straight_flush');
    expect(r.gained).toBe((100 + 5 + 6 + 7 + 8 + 9) * 8);
    expect(r.gained).toBe(1080);
  });

  it('only the scoring cards count — kickers are ignored', () => {
    // Pair of 7s + K + Q + 2 kickers → only the two 7s score: (10 + 7 + 7) × 2 = 48.
    const r = scorePlay([card(R['7'], 0), card(R['7'], 1), card(R.K, 2), card(R.Q, 3), card(R['2'], 0)]);
    expect(r.type).toBe('pair');
    expect(r.gained).toBe((HAND_TABLE.pair.base + 7 + 7) * HAND_TABLE.pair.mult);
    expect(r.gained).toBe(48);
  });

  it('high card scores only the highest card', () => {
    // 2,5,9,J,K mixed suits → high card = K only: (5 + 10) × 1 = 15.
    const r = scorePlay([card(R['2'], 0), card(R['5'], 1), card(R['9'], 2), card(R.J, 3), card(R.K, 0)]);
    expect(r.type).toBe('high_card');
    expect(r.gained).toBe((HAND_TABLE.high_card.base + 10) * 1);
    expect(r.gained).toBe(15);
  });
});

// ---- Monte-Carlo win-rate band ---------------------------------------------
// Simulate a greedy strategy and assert the win-rate lands in a sensible band so
// that RTP = winRate × reward(2.0) ≈ 0.9–1.0. Tune BALATRO_TARGET until green.

function shuffled(rng: () => number): number[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

// Best-scoring play among all subsets of size 1..5 of the hand.
function bestPlay(hand: number[]): { cards: number[]; gained: number } {
  let best = { cards: [hand[0]!], gained: scorePlay([hand[0]!]).gained };
  const n = hand.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const sel: number[] = [];
    for (let b = 0; b < n; b++) if (mask & (1 << b)) sel.push(hand[b]!);
    if (sel.length > 5) continue;
    const g = scorePlay(sel).gained;
    if (g > best.gained) best = { cards: sel, gained: g };
  }
  return best;
}

// Greedy: while we have discards and the hand is weak (no pair-or-better), throw
// away the lowest cards; otherwise play the best available hand.
function simulateOne(rng: () => number): boolean {
  const deck = shuffled(rng);
  let pos = 0;
  const hand: number[] = [];
  while (hand.length < 8) hand.push(deck[pos++]!);

  let score = 0;
  let handsLeft = BALATRO_HANDS;
  let discardsLeft = BALATRO_DISCARDS;

  const draw = (n: number) => {
    for (let i = 0; i < n && pos < deck.length; i++) hand.push(deck[pos++]!);
  };
  const remove = (sel: number[]) => {
    for (const c of sel) {
      const idx = hand.indexOf(c);
      if (idx >= 0) hand.splice(idx, 1);
    }
  };

  while (handsLeft > 0) {
    const play = bestPlay(hand);
    const type = scorePlay(play.cards).type;
    const strong = type !== 'high_card';

    // Early on, with discards to spare and a weak hand, refine by discarding the
    // 3 lowest-chip cards not part of a current pair.
    const reserve = handsLeft <= 2 ? 80 : 60; // play more readily when hands run low
    if (discardsLeft > 0 && (!strong || play.gained < reserve)) {
      // Discard the lowest-chip cards (up to 5), keeping any duplicated ranks.
      const counts = new Map<number, number>();
      for (const c of hand) counts.set(cardRank(c), (counts.get(cardRank(c)) ?? 0) + 1);
      const junk = hand
        .filter((c) => (counts.get(cardRank(c)) ?? 0) === 1)
        .sort((a, b) => chipValue(cardRank(a)) - chipValue(cardRank(b)))
        .slice(0, 5);
      const toDiscard = junk.length > 0 ? junk : hand.slice(0, 1);
      remove(toDiscard);
      draw(toDiscard.length);
      discardsLeft--;
      continue;
    }

    score += play.gained;
    remove(play.cards);
    draw(play.cards.length);
    handsLeft--;
    if (score >= BALATRO_TARGET) return true;
  }
  return score >= BALATRO_TARGET;
}

describe('Monte-Carlo win-rate', () => {
  it('greedy strategy wins ~45-55% (RTP ≈ 0.9-1.0)', () => {
    let seed = 0x9e3779b9;
    const rng = () => {
      // Mulberry32 — deterministic so the test is stable.
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const N = 6000;
    let wins = 0;
    for (let i = 0; i < N; i++) if (simulateOne(rng)) wins++;
    const winRate = wins / N;
    // RTP ≈ winRate × reward(2.0); kept in a sane band so the game is fair-ish.
    expect(winRate).toBeGreaterThanOrEqual(0.4);
    expect(winRate).toBeLessThanOrEqual(0.6);
  }, 30000);
});
