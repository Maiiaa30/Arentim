import { describe, expect, it } from 'vitest';
import {
  STRIP,
  SYMBOLS,
  LINES,
  PAYTABLE,
  videoSlotRtp,
  evaluateGrid,
  spinGrid,
} from './videoSlot';

/**
 * Economic + correctness mirror of play_video_slot in
 * supabase/migrations/20260625400000_video_slot.sql. Pins the strip weights,
 * the return-to-player band, and the line-evaluation rules so a careless
 * paytable or strip edit can't quietly wreck the (play-money) economy.
 */
describe('videoSlot strip', () => {
  it('is 40 symbols long', () => {
    expect(STRIP).toHaveLength(40);
  });

  it('has the specified symbol counts', () => {
    const counts: Record<string, number> = {};
    for (const id of STRIP) counts[id] = (counts[id] ?? 0) + 1;
    expect(counts).toEqual({
      clover: 9,
      horseshoe: 7,
      coin: 6,
      bell: 5,
      ruby: 4,
      ring: 3,
      crown: 3,
      diamond: 2,
      seven: 1,
    });
  });

  it('only uses the nine known symbols', () => {
    for (const id of STRIP) expect(SYMBOLS).toContain(id as (typeof SYMBOLS)[number]);
  });
});

describe('videoSlotRtp', () => {
  it('is inside the [0.90, 0.94] band', () => {
    const rtp = videoSlotRtp();
    expect(rtp).toBeGreaterThanOrEqual(0.9);
    expect(rtp).toBeLessThanOrEqual(0.94);
  });
});

describe('evaluateGrid', () => {
  // Build a grid where row 1 (the middle, = LINES[0]) shows a chosen run of
  // `sym` for `len` reels, then a different symbol, and everything else clover.
  function gridWithMidRun(sym: string, len: number): string[][] {
    const grid: string[][] = [];
    for (let r = 0; r < 5; r++) {
      let mid = 'clover';
      if (r < len) mid = sym;
      else if (r === len) mid = sym === 'ruby' ? 'bell' : 'ruby'; // break the run
      // keep top/bottom out of the way (use a symbol that won't form a run)
      grid.push(['crown', mid, 'diamond']);
    }
    return grid;
  }

  it('pays a 3-of-a-kind run with the right multiplier', () => {
    const res = evaluateGrid(gridWithMidRun('ruby', 3));
    const mid = res.lines.find((l) => l.line === 0);
    expect(mid).toBeDefined();
    expect(mid!.symbol).toBe('ruby');
    expect(mid!.len).toBe(3);
    expect(mid!.mult).toBe(PAYTABLE.ruby[0]);
  });

  it('pays a 4-of-a-kind run with the right multiplier', () => {
    const res = evaluateGrid(gridWithMidRun('bell', 4));
    const mid = res.lines.find((l) => l.line === 0);
    expect(mid!.len).toBe(4);
    expect(mid!.mult).toBe(PAYTABLE.bell[1]);
  });

  it('pays a 5-of-a-kind run with the right multiplier', () => {
    const res = evaluateGrid(gridWithMidRun('coin', 5));
    const mid = res.lines.find((l) => l.line === 0);
    expect(mid!.len).toBe(5);
    expect(mid!.mult).toBe(PAYTABLE.coin[2]);
  });

  it('returns no wins and zero multiplier on a non-paying grid', () => {
    // Alternate symbols so no line ever gets a left-aligned run of 3.
    const grid: string[][] = [];
    for (let r = 0; r < 5; r++) {
      grid.push(r % 2 === 0 ? ['clover', 'coin', 'ring'] : ['bell', 'ruby', 'crown']);
    }
    const res = evaluateGrid(grid);
    expect(res.lines).toHaveLength(0);
    expect(res.totalMult).toBe(0);
    expect(res.jackpot).toBe(false);
  });

  it('detects the jackpot on five sevens across the middle line', () => {
    const grid: string[][] = [];
    for (let r = 0; r < 5; r++) grid.push(['clover', 'seven', 'clover']);
    const res = evaluateGrid(grid);
    expect(res.jackpot).toBe(true);
    const mid = res.lines.find((l) => l.line === 0);
    expect(mid!.symbol).toBe('seven');
    expect(mid!.len).toBe(5);
    expect(mid!.mult).toBe(PAYTABLE.seven[2]);
  });

  it('divides the summed line multipliers by the line count', () => {
    // All five reels identical → every line is a 5-run of the same symbol.
    const grid: string[][] = [];
    for (let r = 0; r < 5; r++) grid.push(['clover', 'clover', 'clover']);
    const res = evaluateGrid(grid);
    expect(res.lines).toHaveLength(LINES.length);
    // Each line: clover with whatever its left-aligned run length is. Lines
    // that stay on clover for all 5 reels pay pay5; here all rows are clover so
    // every line is a 5-run.
    const expectedSum = res.lines.reduce((s, l) => s + l.mult, 0);
    expect(res.totalMult).toBeCloseTo(expectedSum / LINES.length, 10);
  });
});

describe('spinGrid', () => {
  it('builds 5 reels of 3 rows from the strip with wrapping', () => {
    const grid = spinGrid([0, 0, 0, 0, 0]);
    expect(grid).toHaveLength(5);
    for (const reel of grid) expect(reel).toHaveLength(3);
    expect(grid[0]).toEqual([STRIP[0], STRIP[1], STRIP[2]]);
  });

  it('wraps around the end of the strip', () => {
    const grid = spinGrid([39, 0, 0, 0, 0]);
    expect(grid[0]).toEqual([STRIP[39], STRIP[0], STRIP[1]]);
  });
});
