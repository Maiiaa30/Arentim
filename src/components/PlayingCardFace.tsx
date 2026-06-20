/**
 * The one playing-card look, shared across poker, blackjack and anywhere else a
 * card is shown. Classic & clean: white face, crisp corner indices (rank over
 * suit, red for hearts/diamonds), a single large centre pip, and a gilded
 * patterned back. Callers resolve their own encoding to a rank label + suit
 * index and hand them in, so this component stays encoding-agnostic.
 */
const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];

const SIZES = {
  sm: { w: 40, h: 56, rank: 'text-[12px]', suit: 'text-[9px]', center: 'text-[20px]' },
  md: { w: 60, h: 84, rank: 'text-[16px]', suit: 'text-[12px]', center: 'text-[34px]' },
  lg: { w: 74, h: 104, rank: 'text-[20px]', suit: 'text-[15px]', center: 'text-[42px]' },
  xl: { w: 92, h: 130, rank: 'text-[25px]', suit: 'text-[18px]', center: 'text-[54px]' },
} as const;

export type CardSize = keyof typeof SIZES;

export function PlayingCardFace({
  rank,
  suit = 0,
  faceDown = false,
  size = 'md',
}: {
  rank?: string | null | undefined;
  suit?: number;
  faceDown?: boolean;
  size?: CardSize;
}) {
  const s = SIZES[size];
  const box = { width: s.w, height: s.h };

  // Face-down — gilded patterned back.
  if (faceDown || rank == null) {
    return (
      <div
        className="relative overflow-hidden rounded-md border border-gold/40 shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
        style={{ ...box, background: 'repeating-linear-gradient(45deg,#15110a 0,#15110a 4px,#1d1609 4px,#1d1609 8px)' }}
        aria-hidden
      >
        <span className="absolute inset-[3px] rounded-[3px] border border-gold/30" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-[11px] font-bold text-gold/70">A</span>
      </div>
    );
  }

  const red = suit === 1 || suit === 2; // hearts, diamonds
  const color = red ? 'text-[#c0202a]' : 'text-[#16130d]';
  const glyph = SUIT_GLYPH[suit] ?? '♠';
  const pip = (
    <span className="flex flex-col items-center leading-none">
      <span className={`${s.rank} font-display font-bold`}>{rank}</span>
      <span className={s.suit}>{glyph}</span>
    </span>
  );

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-black/15 bg-gradient-to-b from-white to-[#efece4] leading-none shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${color}`}
      style={box}
    >
      <span className="absolute left-[7%] top-[5%]">{pip}</span>
      <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${s.center} opacity-90`} aria-hidden>
        {glyph}
      </span>
      <span className="absolute bottom-[5%] right-[7%] rotate-180">{pip}</span>
    </div>
  );
}
