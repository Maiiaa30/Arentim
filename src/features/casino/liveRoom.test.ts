import { describe, it, expect } from 'vitest';
import { crashMult, crashFlySeconds, autoCashWins, secondsLeft, CRASH_K } from './liveRoom';

describe('crash live-room math (mirrors the server)', () => {
  it('starts at 1.00× and never dips below it', () => {
    expect(crashMult(0)).toBe(1);
    expect(crashMult(-5)).toBe(1);
    expect(crashMult(0.0001)).toBe(1);
  });

  it('grows monotonically with elapsed time', () => {
    let prev = 0;
    for (let t = 0; t <= 30; t += 0.5) {
      const m = crashMult(t);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });

  it('truncates to two decimals like SQL floor(exp(k·t)*100)/100', () => {
    const t = 4;
    const raw = Math.exp(CRASH_K * t);
    expect(crashMult(t)).toBe(Math.floor(raw * 100) / 100);
  });

  it('reaches a crash point at its computed flight time', () => {
    // The server busts on now() >= bust_at (time-driven), so at the bust instant
    // the floored multiplier sits within a cent of the crash point — never above.
    for (const crash of [1.2, 2, 5, 13.37, 100]) {
      const secs = crashFlySeconds(crash);
      expect(crashMult(secs)).toBeLessThanOrEqual(crash);
      expect(crashMult(secs)).toBeGreaterThan(crash - 0.02);
      // A moment earlier it has not yet reached the crash point.
      expect(crashMult(secs - 0.25)).toBeLessThan(crash);
    }
  });

  it('settles auto cash-outs exactly as crash_settle_room does', () => {
    expect(autoCashWins(2, 5)).toBe(true); // target before bust → win
    expect(autoCashWins(5, 5)).toBe(false); // target == bust → loss
    expect(autoCashWins(6, 5)).toBe(false); // target after bust → loss
    expect(autoCashWins(null, 5)).toBe(false); // no auto target → held to bust
  });
});

describe('secondsLeft countdown', () => {
  it('counts down whole seconds and floors at zero', () => {
    const now = 1_000_000;
    expect(secondsLeft(new Date(now + 6000).toISOString(), now)).toBe(6);
    expect(secondsLeft(new Date(now + 5400).toISOString(), now)).toBe(6); // ceil
    expect(secondsLeft(new Date(now - 3000).toISOString(), now)).toBe(0); // past → 0
  });
});
