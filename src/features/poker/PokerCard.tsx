import { RANK_CHARS, SUIT_CHARS, suitOf } from '../../../supabase/functions/_shared/poker';

const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];

/**
 * Renders a poker card (encoding 0–51, rank = card%13 with 0=Two), or a patterned
 * back for -1. Two sizes: `small` for seats, default for the community board.
 * Everything is clipped to the card bounds so pips never spill outside.
 */
export function PokerCard({ card, small }: { card: number; small?: boolean }) {
  const size = small ? 'h-[44px] w-[31px] rounded-[4px]' : 'h-16 w-[46px] rounded-[5px]';
  const rankCls = small ? 'text-[11px]' : 'text-[15px]';
  const suitCls = small ? 'text-[8px]' : 'text-[11px]';
  const centerCls = small ? 'text-[15px]' : 'text-2xl';

  // Face-down card — gilded patterned back.
  if (card < 0) {
    return (
      <div
        className={`relative flex ${size} items-center justify-center overflow-hidden border border-gold/30 shadow-[0_2px_5px_rgba(0,0,0,0.5)]`}
        style={{
          background: 'repeating-linear-gradient(45deg,#1a1208 0,#1a1208 4px,#221708 4px,#221708 8px)',
        }}
        aria-hidden
      >
        <div className="absolute inset-[3px] rounded-[2px] border border-gold/25" />
        <span className="font-display text-[10px] font-semibold text-gold/70">A</span>
      </div>
    );
  }

  const suit = suitOf(card);
  const red = suit === 1 || suit === 2;
  const rank = RANK_CHARS[card % 13];
  const glyph = SUIT_GLYPH[suit];

  // A tight rank-over-suit corner pip (leading-none so it can't grow past the card).
  const pip = (
    <span className="flex flex-col items-center leading-none">
      <span className={`${rankCls} font-bold`}>{rank}</span>
      <span className={suitCls}>{glyph}</span>
    </span>
  );

  return (
    <div
      className={`relative ${size} overflow-hidden border border-black/15 bg-gradient-to-b from-white to-[#eceae3] font-display leading-none shadow-[0_3px_7px_rgba(0,0,0,0.5)] ${
        red ? 'text-[#c0392b]' : 'text-[#15110a]'
      }`}
    >
      <span className={`absolute ${small ? 'left-[2px] top-[2px]' : 'left-1 top-1'}`}>{pip}</span>
      <span
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${centerCls} opacity-90`}
        aria-hidden
      >
        {glyph}
      </span>
      <span className={`absolute rotate-180 ${small ? 'bottom-[2px] right-[2px]' : 'bottom-1 right-1'}`}>{pip}</span>
    </div>
  );
}

export { RANK_CHARS, SUIT_CHARS };
