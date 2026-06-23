import { RANK_CHARS, SUIT_CHARS, suitOf } from '../../../supabase/functions/_shared/poker';
import { PlayingCardFace, type CardSize } from '@/components/PlayingCardFace';

/**
 * A poker card (encoding 0–51, rank = card%13 with 0=Two), or a back for -1.
 * Renders the shared classic card face used across the whole app. `size` wins if
 * given; otherwise `small` maps to sm and the default is md.
 */
export function PokerCard({ card, small, size }: { card: number; small?: boolean; size?: CardSize }) {
  const s: CardSize = size ?? (small ? 'sm' : 'md');
  if (card < 0) return <PlayingCardFace faceDown size={s} />;
  // RANK_CHARS uses 'T' for Ten (engine shorthand); show '10' on the face so it
  // doesn't read as a mystery "T" card.
  const r = RANK_CHARS[card % 13];
  return <PlayingCardFace rank={r === 'T' ? '10' : r} suit={suitOf(card)} size={s} />;
}

export { RANK_CHARS, SUIT_CHARS };
