import { describe, it, expect } from 'vitest';
import {
  rankValue,
  suitOf,
  cardCode,
  makeDeck,
  shuffle,
  score5,
  compareScores,
  evaluate,
  handName,
  preflopStrength,
  decideBot,
} from '../../../supabase/functions/_shared/poker';

// Card helper: card(rankIndex, suit) where rankIndex 0=2..12=Ace.
const card = (rankIdx: number, suit: number) => suit * 13 + rankIdx;
const AceI = 12;
const KingI = 11;
const QueenI = 10;
const JackI = 9;
const TenI = 8;

describe('card helpers', () => {
  it('derives value, suit and code', () => {
    expect(rankValue(card(AceI, 0))).toBe(14);
    expect(rankValue(card(0, 0))).toBe(2);
    expect(suitOf(card(0, 2))).toBe(2);
    expect(cardCode(card(AceI, 1))).toBe('Ah');
  });
});

describe('makeDeck / shuffle', () => {
  it('builds 52 unique cards', () => {
    const d = makeDeck();
    expect(d).toHaveLength(52);
    expect(new Set(d).size).toBe(52);
  });
  it('is a permutation under a deterministic rand', () => {
    const d = makeDeck();
    let seed = 1;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const shuffled = shuffle([...d], rand);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled).size).toBe(52);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(d);
  });
});

describe('score5 categories', () => {
  const royalFlush = [card(AceI, 1), card(KingI, 1), card(QueenI, 1), card(JackI, 1), card(TenI, 1)];
  it('ranks each category correctly', () => {
    expect(score5(royalFlush)[0]).toBe(8); // straight flush
    expect(score5([card(2, 0), card(2, 1), card(2, 2), card(2, 3), card(5, 0)])[0]).toBe(7); // quads
    expect(score5([card(2, 0), card(2, 1), card(2, 2), card(5, 0), card(5, 1)])[0]).toBe(6); // full house
    expect(score5([card(AceI, 0), card(9, 0), card(7, 0), card(4, 0), card(2, 0)])[0]).toBe(5); // flush
    expect(score5([card(2, 0), card(3, 1), card(4, 2), card(5, 3), card(6, 0)])[0]).toBe(4); // straight
    expect(score5([card(2, 0), card(2, 1), card(2, 2), card(7, 0), card(9, 1)])[0]).toBe(3); // trips
    expect(score5([card(2, 0), card(2, 1), card(5, 2), card(5, 3), card(9, 0)])[0]).toBe(2); // two pair
    expect(score5([card(2, 0), card(2, 1), card(5, 2), card(7, 3), card(9, 0)])[0]).toBe(1); // pair
    expect(score5([card(0, 0), card(2, 1), card(4, 2), card(7, 3), card(JackI, 0)])[0]).toBe(0); // high: 2,4,6,9,J
  });

  it('treats the wheel A-2-3-4-5 as a 5-high straight', () => {
    const wheel = [card(AceI, 0), card(0, 1), card(1, 2), card(2, 3), card(3, 0)];
    const s = score5(wheel);
    expect(s[0]).toBe(4);
    expect(s[1]).toBe(5); // high card is the 5, not the ace
  });
});

describe('compareScores / evaluate', () => {
  it('orders hands', () => {
    const flush = score5([card(AceI, 0), card(9, 0), card(7, 0), card(4, 0), card(2, 0)]);
    const straight = score5([card(2, 0), card(3, 1), card(4, 2), card(5, 3), card(6, 0)]);
    expect(compareScores(flush, straight)).toBeGreaterThan(0);
  });

  it('finds the best 5 of 7', () => {
    // 7 cards containing a flush
    const seven = [
      card(AceI, 0), card(KingI, 0), card(9, 0), card(4, 0), card(2, 0), // 5 spades -> flush
      card(AceI, 1), card(AceI, 2), // also trip aces, but flush is better
    ];
    expect(handName(evaluate(seven))).toBe('Flush');
  });

  it('higher pair beats lower pair via kickers', () => {
    const aces = evaluate([card(AceI, 0), card(AceI, 1), card(KingI, 2), card(7, 0), card(2, 0)]);
    const kings = evaluate([card(KingI, 0), card(KingI, 1), card(AceI, 2), card(7, 0), card(2, 0)]);
    expect(compareScores(aces, kings)).toBeGreaterThan(0);
  });
});

describe('decideBot', () => {
  const noRand = () => 0.99; // suppress bluffs/coin-flips

  it('checks a weak hand when it is free', () => {
    const d = decideBot({
      hole: [card(0, 0), card(2, 1)], community: [], toCall: 0, pot: 100,
      minRaise: 20, stack: 1000, difficulty: 'medium', rand: noRand,
    });
    expect(d.action).toBe('check');
  });

  it('folds a weak hand facing a large bet', () => {
    const d = decideBot({
      hole: [card(0, 0), card(2, 1)], community: [card(AceI, 2), card(KingI, 3), card(9, 0)],
      toCall: 500, pot: 100, minRaise: 100, stack: 1000, difficulty: 'medium', rand: noRand,
    });
    expect(d.action).toBe('fold');
  });

  it('commits chips with a strong made hand', () => {
    const d = decideBot({
      hole: [card(AceI, 0), card(AceI, 1)], community: [card(AceI, 2), card(KingI, 3), card(9, 0)],
      toCall: 50, pot: 200, minRaise: 50, stack: 1000, difficulty: 'hard', rand: () => 0.5,
    });
    expect(['call', 'raise']).toContain(d.action);
    expect(d.amount).toBeGreaterThan(0);
  });

  it('never commits more than the stack', () => {
    const d = decideBot({
      hole: [card(AceI, 0), card(AceI, 1)], community: [], toCall: 0, pot: 100,
      minRaise: 20, stack: 30, difficulty: 'hard', rand: () => 0.0,
    });
    expect(d.amount).toBeLessThanOrEqual(30);
  });

  it('preflopStrength ranks a pair of aces above 7-2 offsuit', () => {
    expect(preflopStrength([card(AceI, 0), card(AceI, 1)])).toBeGreaterThan(
      preflopStrength([card(5, 0), card(0, 1)]),
    );
  });
});
