import { RANK_CHARS, SUIT_CHARS, suitOf } from '../../../supabase/functions/_shared/poker';

const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];

/** Renders a poker card (encoding 0–51, rank = card%13 with 0=Two), or a back for -1. */
export function PokerCard({ card, small }: { card: number; small?: boolean }) {
  const size = small ? 'h-12 w-9 text-xs' : 'h-16 w-11 text-sm';
  if (card < 0) {
    return (
      <div className={`flex ${size} items-center justify-center rounded-md border border-border bg-accent/20`}>
        <div className="h-2/3 w-2/3 rounded bg-accent/40" />
      </div>
    );
  }
  const suit = suitOf(card);
  const red = suit === 1 || suit === 2;
  return (
    <div className={`flex ${size} flex-col items-center justify-center rounded-md border border-border bg-white font-bold ${red ? 'text-negative' : 'text-black'}`}>
      <span>{RANK_CHARS[card % 13]}</span>
      <span>{SUIT_GLYPH[suit]}</span>
    </div>
  );
}

export { RANK_CHARS, SUIT_CHARS };
