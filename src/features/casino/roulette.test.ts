import { describe, it, expect } from 'vitest';
import {
  colorOf,
  isWinningBet,
  multiplierFor,
  betReturn,
  slipPayout,
  totalStake,
  RED_NUMBERS,
  WHEEL_SEQUENCE,
  type RouletteBet,
} from './roulette';

describe('colorOf', () => {
  it('classifies green/red/black', () => {
    expect(colorOf(0)).toBe('green');
    expect(colorOf(1)).toBe('red');
    expect(colorOf(2)).toBe('black');
    expect(colorOf(36)).toBe('red');
  });
});

describe('wheel data integrity', () => {
  it('has 37 unique pockets 0–36', () => {
    expect(WHEEL_SEQUENCE).toHaveLength(37);
    expect(new Set(WHEEL_SEQUENCE).size).toBe(37);
    expect(Math.min(...WHEEL_SEQUENCE)).toBe(0);
    expect(Math.max(...WHEEL_SEQUENCE)).toBe(36);
  });

  it('has 18 red and 18 black numbers', () => {
    expect(RED_NUMBERS.size).toBe(18);
    const black = WHEEL_SEQUENCE.filter((n) => n !== 0 && !RED_NUMBERS.has(n));
    expect(black).toHaveLength(18);
  });
});

describe('isWinningBet', () => {
  it('straight matches exact number including 0', () => {
    expect(isWinningBet('straight', 17, 17)).toBe(true);
    expect(isWinningBet('straight', 17, 18)).toBe(false);
    expect(isWinningBet('straight', 0, 0)).toBe(true);
  });

  it('0 loses every outside bet', () => {
    for (const kind of [
      'red',
      'black',
      'even',
      'odd',
      'low',
      'high',
      'dozen1',
      'dozen2',
      'dozen3',
      'col1',
      'col2',
      'col3',
    ] as const) {
      expect(isWinningBet(kind, null, 0)).toBe(false);
    }
  });

  it('colour bets', () => {
    expect(isWinningBet('red', null, 1)).toBe(true);
    expect(isWinningBet('black', null, 2)).toBe(true);
    expect(isWinningBet('red', null, 2)).toBe(false);
  });

  it('parity, range, dozens and columns', () => {
    expect(isWinningBet('even', null, 4)).toBe(true);
    expect(isWinningBet('odd', null, 5)).toBe(true);
    expect(isWinningBet('low', null, 18)).toBe(true);
    expect(isWinningBet('high', null, 19)).toBe(true);
    expect(isWinningBet('dozen2', null, 13)).toBe(true);
    expect(isWinningBet('dozen2', null, 12)).toBe(false);
    expect(isWinningBet('col1', null, 1)).toBe(true); // 1 % 3 === 1
    expect(isWinningBet('col3', null, 3)).toBe(true); // 3 % 3 === 0
    expect(isWinningBet('col3', null, 36)).toBe(true);
  });
});

describe('payout math', () => {
  it('multipliers match roulette odds', () => {
    expect(multiplierFor('straight')).toBe(36); // 35:1
    expect(multiplierFor('dozen1')).toBe(3); // 2:1
    expect(multiplierFor('red')).toBe(2); // 1:1
  });

  it('betReturn floors winnings to total return and zero on loss', () => {
    expect(betReturn({ kind: 'straight', selection: 7, stake: 10 }, 7)).toBe(360);
    expect(betReturn({ kind: 'straight', selection: 7, stake: 10 }, 8)).toBe(0);
    expect(betReturn({ kind: 'red', selection: null, stake: 50 }, 1)).toBe(100);
  });

  it('slipPayout and totalStake aggregate the slip', () => {
    const bets: RouletteBet[] = [
      { kind: 'red', selection: null, stake: 100 },
      { kind: 'straight', selection: 17, stake: 10 },
    ];
    expect(totalStake(bets)).toBe(110);
    // Outcome 17 is black, so red loses; straight 17 wins 360.
    expect(slipPayout(bets, 17)).toBe(360);
    // Outcome 1 is red, so red wins 200; straight loses.
    expect(slipPayout(bets, 1)).toBe(200);
  });
});
