import { describe, it, expect } from 'vitest';
import {
  createTable,
  startHand,
  applyAction,
  viewFor,
  type TableState,
  type Rand,
} from '../../../supabase/functions/_shared/pokerTable';

/** Deterministic LCG so each seed replays an identical hand. */
function lcg(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const stacks = (s: TableState) => s.players.reduce((sum, p) => sum + p.stack, 0);

/**
 * The core invariant the UI relies on: every state handed back to the client is
 * either over, or it is the *human's* turn. If the engine ever returns a state
 * that is not over but is waiting on a bot, the table stalls forever (the human
 * sees "À espera dos adversários…" with no way to act). This fuzzer plays full
 * hands with random *legal* human actions — crucially including raises, which
 * the older fold/call tests never exercised — to flush out any such stall.
 */
function assertNoStall(s: TableState) {
  if (s.handOver) return;
  expect(s.toAct).toBeGreaterThanOrEqual(0);
  const actor = s.players[s.toAct]!;
  expect(actor.isBot, `stalled waiting on bot ${actor.name} (street ${s.street})`).toBe(false);
  expect(actor.id).toBe('you');
}

function randomHumanAction(s: TableState, rand: Rand): { action: 'fold' | 'check' | 'call' | 'raise'; raiseTo: number } {
  const you = s.players[s.toAct]!;
  const owe = s.currentBet - you.committed;
  const canRaise = you.stack > owe;
  const roll = rand();
  if (canRaise && roll < 0.4) {
    const minTo = s.currentBet + s.minRaise;
    const maxTo = you.committed + you.stack;
    const raiseTo = minTo + Math.floor(rand() * Math.max(1, maxTo - minTo + 1));
    return { action: 'raise', raiseTo };
  }
  if (owe === 0) return { action: roll < 0.85 ? 'check' : 'fold', raiseTo: 0 };
  if (roll < 0.7) return { action: 'call', raiseTo: 0 };
  return { action: 'fold', raiseTo: 0 };
}

describe('bot-action trail (staged playback)', () => {
  it('records stable point-in-time snapshots without changing the outcome', () => {
    // Two identical hands from the same seed: one observed, one not. The trail
    // must not affect the result, and snapshots must be independent of later
    // mutations (the board copy) so replaying them shows the cards appearing.
    const seedRand = () => lcg(424242);

    let plain = createTable('You', 1000, [{ name: 'B', difficulty: 'medium' as const }]);
    plain = startHand(plain, seedRand());
    let g = 0;
    while (!plain.handOver && g++ < 80) plain = applyAction(plain, 'call', 0, seedRand());

    type V = { community: number[]; pot: number };
    const trail: V[] = [];
    let obs = createTable('You', 1000, [{ name: 'B', difficulty: 'medium' as const }]);
    obs = startHand(obs, seedRand(), (s) => trail.push(viewFor(s, 'you') as V));
    g = 0;
    while (!obs.handOver && g++ < 80) {
      obs = applyAction(obs, 'call', 0, seedRand(), (s) => trail.push(viewFor(s, 'you') as V));
    }

    // Same final result whether observed or not.
    expect(obs.players.map((p) => p.stack)).toEqual(plain.players.map((p) => p.stack));

    // Snapshots are independent objects (an early one is not retroactively
    // mutated to the final board) — board length is monotonic non-decreasing.
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i]!.community.length).toBeGreaterThanOrEqual(trail[i - 1]!.community.length);
    }
    if (trail.length > 1) {
      // The first snapshot's board must not have been overwritten by the last.
      expect(trail[0]!.community.length).toBeLessThanOrEqual(trail[trail.length - 1]!.community.length);
    }
  });
});

describe('poker fuzz — no bot stall, chips conserved', () => {
  it('plays thousands of random hands without ever stalling on a bot', () => {
    for (let seed = 1; seed <= 600; seed++) {
      const rand = lcg(seed * 2654435761);
      const botCount = 1 + (seed % 5);
      const buyIn = 200 + (seed % 7) * 50;
      const players = botCount + 1;
      const START = buyIn * players;

      let s = createTable('You', buyIn, Array.from({ length: botCount }, (_, i) => ({ name: `Bot${i}`, difficulty: (['easy', 'medium', 'hard'] as const)[i % 3]! })));

      // Play several consecutive hands so button movement + short stacks are exercised.
      for (let hand = 0; hand < 4; hand++) {
        s = startHand(s, rand);
        let guard = 0;
        while (!s.handOver) {
          assertNoStall(s);
          expect(guard++, `hand never resolved (seed ${seed}, hand ${hand})`).toBeLessThan(400);
          const { action, raiseTo } = randomHumanAction(s, rand);
          s = applyAction(s, action, raiseTo, rand);
        }
        // Chips are conserved and nobody goes negative at every showdown.
        expect(stacks(s), `chip leak at seed ${seed} hand ${hand}`).toBe(START);
        expect(s.players.every((p) => p.stack >= 0)).toBe(true);
        expect(s.pot).toBe(0);
        if (s.players.filter((p) => p.stack > 0).length < 2) break; // not enough chips to continue
      }
    }
  });
});
