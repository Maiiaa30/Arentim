import { describe, it, expect } from 'vitest';
import {
  createTable,
  createMultiTable,
  addPlayer,
  applyActionFor,
  startHand,
  applyAction,
  viewFor,
  type TableState,
  type Rand,
} from '../../../supabase/functions/_shared/pokerTable';

function lcg(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const total = (s: TableState) => s.players.reduce((sum, p) => sum + p.stack, 0) + s.pot;
const stacks = (s: TableState) => s.players.reduce((sum, p) => sum + p.stack, 0);

function bots(n: number) {
  return Array.from({ length: n }, (_, i) => ({ name: `Bot${i}`, difficulty: 'medium' as const }));
}

describe('chip conservation', () => {
  it('conserves chips through a hand when the human folds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rand = lcg(seed);
      let s = createTable('You', 1000, bots(2));
      const START = 3000;
      s = startHand(s, rand);
      expect(total(s)).toBe(START);
      let guard = 0;
      while (!s.handOver && guard++ < 50) {
        expect(viewFor(s, 'you')).toBeTruthy();
        s = applyAction(s, 'fold', 0, rand);
      }
      expect(s.handOver).toBe(true);
      expect(stacks(s)).toBe(START); // pot fully distributed, nothing created/lost
      expect(s.players.every((p) => p.stack >= 0)).toBe(true);
    }
  });

  it('conserves chips when the human calls down to showdown', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rand = lcg(seed * 7 + 3);
      let s = createTable('You', 1500, bots(3));
      const START = 1500 * 4;
      s = startHand(s, rand);
      let guard = 0;
      while (!s.handOver && guard++ < 80) {
        s = applyAction(s, 'call', 0, rand); // call (becomes check when nothing owed)
      }
      expect(s.handOver).toBe(true);
      expect(stacks(s)).toBe(START);
      expect(s.players.every((p) => p.stack >= 0)).toBe(true);
    }
  });
});

describe('multiplayer table', () => {
  it('seats two humans + a bot and conserves chips across hands', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const rand = lcg(seed * 13 + 1);
      let s = createMultiTable();
      addPlayer(s, { id: 'alice', name: 'Alice', isBot: false, difficulty: 'medium', stack: 1000 });
      addPlayer(s, { id: 'bob', name: 'Bob', isBot: false, difficulty: 'medium', stack: 1000 });
      addPlayer(s, { id: 'bot1', name: 'Bot', isBot: true, difficulty: 'medium', stack: 1000 });
      const START = 3000;
      s = startHand(s, rand);
      let guard = 0;
      while (!s.handOver && guard++ < 80) {
        if (s.toAct < 0) break;
        const actorId = s.players[s.toAct]!.id; // current human to act (bots auto-play)
        s = applyActionFor(s, actorId, 'call', 0, rand);
      }
      expect(s.handOver).toBe(true);
      expect(s.players.reduce((t, p) => t + p.stack, 0)).toBe(START);
      expect(s.players.every((p) => p.stack >= 0)).toBe(true);
    }
  });

  it('rejects an action from a player when it is not their turn', () => {
    const rand = lcg(3);
    let s = createMultiTable();
    addPlayer(s, { id: 'alice', name: 'Alice', isBot: false, difficulty: 'medium', stack: 1000 });
    addPlayer(s, { id: 'bob', name: 'Bob', isBot: false, difficulty: 'medium', stack: 1000 });
    s = startHand(s, rand);
    const notTurn = s.players[(s.toAct + 1) % s.players.length]!.id;
    const before = JSON.stringify(s);
    s = applyActionFor(s, notTurn, 'fold', 0, rand);
    expect(JSON.stringify(s)).toBe(before); // no-op
  });
});

describe('viewFor', () => {
  it('hides bot hole cards before showdown and shows the human their own', () => {
    const rand = lcg(99);
    let s = createTable('You', 1000, bots(2));
    s = startHand(s, rand);
    const view = viewFor(s, 'you') as {
      street: string;
      players: { id: string; isBot: boolean; hole: number[] }[];
    };
    const you = view.players.find((p) => p.id === 'you')!;
    expect(you.hole.every((c) => c >= 0)).toBe(true); // own cards visible
    if (view.street !== 'showdown') {
      for (const p of view.players.filter((pp) => pp.isBot)) {
        expect(p.hole.every((c) => c === -1)).toBe(true); // bots hidden
      }
    }
  });
});

describe('blinds', () => {
  it('moves chips into the pot at the start of a hand', () => {
    const rand = lcg(5);
    let s = createTable('You', 1000, bots(1)); // heads-up
    s = startHand(s, rand);
    expect(s.pot).toBeGreaterThanOrEqual(s.smallBlind + s.bigBlind - 0);
    expect(s.street === 'preflop' || s.handOver).toBe(true);
  });
});
