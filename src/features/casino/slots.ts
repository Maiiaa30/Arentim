/**
 * Slots — 3 reels, Arentim-themed. Pure logic mirrored from the play_slots SQL.
 * The server is authoritative; this drives the UI and is unit tested (incl. RTP).
 */

export type SlotSymbol = 'coin' | 'seven' | 'galo' | 'wine' | 'sardine';

/** 16-position reel strip (index → symbol). Matches public.slots_symbol. */
export const REEL_STRIP: readonly SlotSymbol[] = [
  'coin',
  'seven',
  'seven',
  'galo',
  'galo',
  'galo',
  'wine',
  'wine',
  'wine',
  'wine',
  'sardine',
  'sardine',
  'sardine',
  'sardine',
  'sardine',
  'sardine',
];

const PAY3: Record<SlotSymbol, number> = { coin: 100, seven: 40, galo: 18, wine: 13, sardine: 7 };
const PAY2: Record<SlotSymbol, number> = { coin: 3, seven: 1, galo: 0, wine: 0, sardine: 0 };

/** Total-return multiplier (on stake) for three reel symbols. Mirrors SQL. */
export function slotsMultiplier(s1: SlotSymbol, s2: SlotSymbol, s3: SlotSymbol): number {
  if (s1 === s2 && s2 === s3) return PAY3[s1];
  let pair: SlotSymbol | null = null;
  if (s1 === s2 || s1 === s3) pair = s1;
  else if (s2 === s3) pair = s2;
  if (pair === null) return 0;
  return PAY2[pair];
}
