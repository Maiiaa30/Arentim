/**
 * Texas Hold'em engine — pure, deterministic, dependency-free. Shared by the
 * server dealer (Edge Function), the client UI, and unit tests.
 *
 * Cards are integers 0–51: rank index = card % 13 (0 = Two … 12 = Ace),
 * value = rank index + 2 (so 2..14, Ace high); suit = floor(card / 13).
 */

export const RANK_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUIT_CHARS = ['s', 'h', 'd', 'c'];

export function rankValue(card: number): number {
  return (card % 13) + 2; // 2..14
}
export function suitOf(card: number): number {
  return Math.floor(card / 13);
}
export function cardCode(card: number): string {
  return `${RANK_CHARS[card % 13]}${SUIT_CHARS[suitOf(card)]}`;
}

export const HAND_NAMES = [
  'High card',
  'Pair',
  'Two pair',
  'Three of a kind',
  'Straight',
  'Flush',
  'Full house',
  'Four of a kind',
  'Straight flush',
];

/** Build a fresh ordered 52-card deck. */
export function makeDeck(): number[] {
  return Array.from({ length: 52 }, (_, i) => i);
}

/** In-place Fisher–Yates using an injected uniform `rand(n) -> [0,n)`. */
export function shuffle(deck: number[], rand: (n: number) => number): number[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

function straightHigh(uniqueDesc: number[]): number | null {
  // uniqueDesc: distinct rank values, descending. Returns the straight's high
  // card, or null. Handles the wheel (A-2-3-4-5 -> high 5).
  const vals = [...uniqueDesc];
  if (vals.includes(14)) vals.push(1); // Ace can be low
  let run = 1;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] === vals[i - 1]! - 1) {
      run += 1;
      if (run >= 5) return vals[i - 4]!;
    } else if (vals[i] !== vals[i - 1]) {
      run = 1;
    }
  }
  return null;
}

/** Score a 5-card hand as a comparable array: [category, ...tiebreakers]. */
export function score5(cards: number[]): number[] {
  const values = cards.map(rankValue).sort((a, b) => b - a);
  const suits = cards.map(suitOf);
  const isFlush = suits.every((s) => s === suits[0]);

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  // groups sorted by count desc, then value desc
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const uniqueDesc = [...counts.keys()].sort((a, b) => b - a);
  const sHigh = straightHigh(uniqueDesc);

  if (isFlush && sHigh !== null) return [8, sHigh];
  if (groups[0]![1] === 4) return [7, groups[0]![0], groups[1]![0]];
  if (groups[0]![1] === 3 && groups[1]![1] === 2) return [6, groups[0]![0], groups[1]![0]];
  if (isFlush) return [5, ...values];
  if (sHigh !== null) return [4, sHigh];
  if (groups[0]![1] === 3) return [3, groups[0]![0], ...groups.slice(1).map((g) => g[0])];
  if (groups[0]![1] === 2 && groups[1]![1] === 2)
    return [2, groups[0]![0], groups[1]![0], groups[2]![0]];
  if (groups[0]![1] === 2) return [1, groups[0]![0], ...groups.slice(1).map((g) => g[0])];
  return [0, ...values];
}

/** Compare two score arrays lexicographically. >0 if a beats b. */
export function compareScores(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function* combinations5(cards: number[]): Generator<number[]> {
  const n = cards.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++)
            yield [cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!];
}

/** Best 5-card score from 5–7 cards. */
export function evaluate(cards: number[]): number[] {
  if (cards.length < 5) throw new Error('need at least 5 cards');
  let best: number[] | null = null;
  for (const combo of combinations5(cards)) {
    const s = score5(combo);
    if (best === null || compareScores(s, best) > 0) best = s;
  }
  return best!;
}

export function handName(score: number[]): string {
  return HAND_NAMES[score[0]!]!;
}

// ---- Bot AI ----------------------------------------------------------------

export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type PokerAction = 'fold' | 'check' | 'call' | 'raise';

/** Rough preflop strength in [0,1] from two hole cards. */
export function preflopStrength(hole: number[]): number {
  const [a, b] = [rankValue(hole[0]!), rankValue(hole[1]!)].sort((x, y) => y - x) as [number, number];
  const suited = suitOf(hole[0]!) === suitOf(hole[1]!);
  if (a === b) return Math.min(1, 0.5 + (a - 2) / 24); // pair
  let s = ((a - 2) / 12) * 0.4 + ((b - 2) / 12) * 0.2;
  if (suited) s += 0.1;
  if (a - b === 1) s += 0.08; // connected
  if (a >= 10 && b >= 10) s += 0.12; // both broadway
  return Math.max(0, Math.min(1, s));
}

/** Made-hand strength in [0,1] from category of the best current hand. */
export function postflopStrength(hole: number[], community: number[]): number {
  const cat = evaluate([...hole, ...community])[0]!;
  return [0.18, 0.35, 0.55, 0.7, 0.8, 0.86, 0.93, 0.98, 1][cat]!;
}

export interface BotContext {
  hole: number[];
  community: number[];
  toCall: number; // chips needed to call
  pot: number;
  minRaise: number; // minimum additional raise over the call
  stack: number; // bot's remaining chips
  difficulty: BotDifficulty;
  rand: () => number; // uniform [0,1)
}

/**
 * Heuristic bot action: blends hand strength, pot odds, position-agnostic
 * aggression and a little bluffing. Always returns a legal action/amount.
 * `amount` is the TOTAL additional chips the bot commits this action.
 */
export function decideBot(ctx: BotContext): { action: PokerAction; amount: number } {
  const { hole, community, toCall, pot, minRaise, stack, difficulty, rand } = ctx;
  const strength = community.length === 0 ? preflopStrength(hole) : postflopStrength(hole, community);

  const aggression = difficulty === 'hard' ? 0.22 : difficulty === 'medium' ? 0.14 : 0.07;
  const bluffFreq = difficulty === 'hard' ? 0.12 : difficulty === 'medium' ? 0.07 : 0.03;

  const raiseSize = Math.max(minRaise, Math.floor(pot * 0.6));
  const clampRaise = Math.min(raiseSize, stack - toCall);

  if (toCall === 0) {
    // Free to check. Bet/raise when strong or occasionally as a bluff.
    if ((strength > 0.62 || rand() < bluffFreq) && clampRaise > 0) {
      return { action: 'raise', amount: toCall + clampRaise };
    }
    return { action: 'check', amount: 0 };
  }

  const potOdds = toCall / (pot + toCall);
  // Strong enough to raise?
  if (strength > 0.78 - aggression && clampRaise > 0 && rand() > 0.4) {
    return { action: 'raise', amount: toCall + clampRaise };
  }
  // Worth a call?
  if (strength >= potOdds + 0.05 || rand() < bluffFreq) {
    return { action: 'call', amount: Math.min(toCall, stack) };
  }
  return { action: 'fold', amount: 0 };
}
