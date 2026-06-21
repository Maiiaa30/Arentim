/**
 * Fortuna de Ouro — a 5-reel × 3-row, 9-payline video slot.
 *
 * Pure-JS economic engine, an exact mirror of the SQL in
 * supabase/migrations/20260625400000_video_slot.sql. The server is
 * authoritative; this module exists so the client can render outcomes the
 * server already computed, and so the maths is unit-tested independently of
 * Postgres.
 *
 * RTP is normalised to be independent of the number of paylines: a line pays
 * the longest left-aligned run of one symbol, the winning lines' multipliers
 * are summed and divided by the line count, and `payout = floor(stake × mult)`.
 * That makes the house edge equal to a single line's expected return. With the
 * tuned PAYTABLE below, `videoSlotRtp()` ≈ 0.9175 (house edge ≈ 8.25%).
 */

/** The nine symbol ids, high→low display order. Reused premium SVG art. */
export const SYMBOLS = [
  'seven',
  'diamond',
  'crown',
  'ring',
  'ruby',
  'bell',
  'coin',
  'horseshoe',
  'clover',
] as const;

export type Sym = (typeof SYMBOLS)[number];

/**
 * One weighted reel strip of length 40, used identically on all five reels.
 * Counts: clover 9, horseshoe 7, coin 6, bell 5, ruby 4, ring 3, crown 3,
 * diamond 2, seven 1 (sum 40). Order doesn't affect RTP — duplicates are
 * spread out so the spin reads as a varied reel rather than clumps.
 */
export const STRIP: string[] = [
  'clover', 'horseshoe', 'coin', 'bell', 'clover',
  'ruby', 'horseshoe', 'ring', 'clover', 'coin',
  'crown', 'bell', 'horseshoe', 'clover', 'diamond',
  'coin', 'ruby', 'clover', 'horseshoe', 'bell',
  'ring', 'clover', 'coin', 'crown', 'horseshoe',
  'ruby', 'clover', 'bell', 'seven', 'coin',
  'clover', 'horseshoe', 'ring', 'ruby', 'bell',
  'diamond', 'clover', 'coin', 'crown', 'horseshoe',
];

/**
 * Nine fixed paylines over the 3-row grid. Each is an array of 5 row indices
 * (0 = top, 1 = middle, 2 = bottom), one per reel.
 */
export const LINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
];

/**
 * Per-LINE multipliers: `[pay3, pay4, pay5]` for a left-aligned run of that
 * length. Tuned so `videoSlotRtp()` lands inside [0.90, 0.94]. Values are large
 * because the summed line multiplier is divided by `LINES.length` (9).
 */
export const PAYTABLE: Record<Sym, [number, number, number]> = {
  seven: [950, 7500, 65000],
  diamond: [330, 2300, 14500],
  crown: [165, 1020, 5200],
  ring: [115, 680, 3600],
  ruby: [58, 330, 1750],
  bell: [28, 165, 950],
  coin: [16, 100, 520],
  horseshoe: [10, 50, 300],
  clover: [5, 30, 150],
};

/** Per-symbol landing counts on the shared strip (derived from STRIP). */
function stripCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of STRIP) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/**
 * Exact return-to-player for a single line (which, after the ÷ LINES.length
 * normalisation, equals the whole machine's RTP). With `q = count/40` the same
 * on every reel, a line pays exactly length L iff reels 0..L-1 all show the
 * symbol and (when L < 5) reel L does not:
 *   RTP = Σ_s [ p3·q³(1-q) + p4·q⁴(1-q) + p5·q⁵ ].
 */
export function videoSlotRtp(): number {
  const counts = stripCounts();
  const n = STRIP.length;
  let rtp = 0;
  for (const sym of SYMBOLS) {
    const q = (counts[sym] ?? 0) / n;
    const [p3, p4, p5] = PAYTABLE[sym];
    rtp += p3 * q ** 3 * (1 - q) + p4 * q ** 4 * (1 - q) + p5 * q ** 5;
  }
  return rtp;
}

export type LineWin = { line: number; symbol: string; len: number; mult: number };

export type GridEval = {
  lines: LineWin[];
  totalMult: number;
  jackpot: boolean;
};

/**
 * Evaluate a 5×3 grid (`grid[reel][row]`). For each payline, take the symbol on
 * reel 0 and count its longest left-aligned run; runs of length ≥ 3 pay
 * `PAYTABLE[symbol][len-3]`. The total multiplier is the sum of winning-line
 * multipliers divided by the number of lines. Jackpot = any line is a 5-run of
 * `seven`.
 */
export function evaluateGrid(grid: string[][]): GridEval {
  const lines: LineWin[] = [];
  let sum = 0;
  let jackpot = false;

  for (let i = 0; i < LINES.length; i++) {
    const rows = LINES[i]!;
    const symbol = grid[0]![rows[0]!]!;
    let len = 1;
    for (let reel = 1; reel < 5; reel++) {
      if (grid[reel]![rows[reel]!] === symbol) len++;
      else break;
    }
    if (len >= 3 && symbol in PAYTABLE) {
      // len is 3..5, so len-3 is 0..2 — a valid tuple index.
      const mult = PAYTABLE[symbol as Sym][len - 3]!;
      lines.push({ line: i, symbol, len, mult });
      sum += mult;
      if (symbol === 'seven' && len === 5) jackpot = true;
    }
  }

  return { lines, totalMult: sum / LINES.length, jackpot };
}

/**
 * Build the 5×3 grid from five stop indices. Reel r shows the three strip cells
 * starting at its stop: `[STRIP[stop], STRIP[stop+1], STRIP[stop+2]]` (wrapping).
 */
export function spinGrid(stops: number[]): string[][] {
  const n = STRIP.length;
  const grid: string[][] = [];
  for (let r = 0; r < 5; r++) {
    const stop = stops[r]!;
    grid.push([
      STRIP[(stop + 0) % n]!,
      STRIP[(stop + 1) % n]!,
      STRIP[(stop + 2) % n]!,
    ]);
  }
  return grid;
}

/** The exact shape returned by `play_video_slot` / the `useVideoSlot` hook. */
export type VideoSlotResult = {
  grid: string[][];
  lines: { line: number; symbol: string; len: number; mult: number }[];
  multiplier: number;
  jackpot: boolean;
  payout: number;
  balance: number;
  replayed: boolean;
};
