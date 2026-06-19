import { RANK_CHARS, SUIT_CHARS, suitOf } from '../../../supabase/functions/_shared/poker';

const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];

/**
 * Renders a poker card (encoding 0–51, rank = card%13 with 0=Two), or a patterned
 * back for -1. Two sizes: `small` for seats, default for the community board.
 */
export function PokerCard({ card, small }: { card: number; small?: boolean }) {
  const size = small ? 'h-[42px] w-[30px] rounded-[4px] text-[13px]' : 'h-16 w-[46px] rounded-[5px] text-lg';

  // Face-down card — gilded patterned back.
  if (card < 0) {
    return (
      <div
        className={`relative flex ${size} items-center justify-center border border-gold/30 shadow-[0_2px_5px_rgba(0,0,0,0.5)]`}
        style={{
          background:
            'repeating-linear-gradient(45deg,#1a1208 0,#1a1208 4px,#221708 4px,#221708 8px)',
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

  return (
    <div
      className={`relative flex ${size} flex-col justify-between border border-black/15 bg-gradient-to-b from-white to-[#eceae3] font-display font-bold leading-none shadow-[0_3px_7px_rgba(0,0,0,0.5)] ${
        red ? 'text-[#c0392b]' : 'text-[#15110a]'
      }`}
    >
      <div className={`flex flex-col items-center self-start ${small ? 'pl-[3px] pt-[2px]' : 'pl-1 pt-0.5'}`}>
        <span>{rank}</span>
        <span className={small ? 'text-[10px]' : 'text-xs'}>{glyph}</span>
      </div>
      <span
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${
          small ? 'text-base' : 'text-2xl'
        } opacity-90`}
        aria-hidden
      >
        {glyph}
      </span>
      <div className={`flex rotate-180 flex-col items-center self-start ${small ? 'pl-[3px] pb-[2px]' : 'pl-1 pb-0.5'}`}>
        <span>{rank}</span>
        <span className={small ? 'text-[10px]' : 'text-xs'}>{glyph}</span>
      </div>
    </div>
  );
}

export { RANK_CHARS, SUIT_CHARS };
