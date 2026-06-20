import { RANK_CHARS, SUIT_CHARS, suitOf } from '../../../supabase/functions/_shared/poker';
import { PlayingCardFace } from '@/components/PlayingCardFace';

/**
 * A poker card (encoding 0–51, rank = card%13 with 0=Two), or a back for -1.
 * Renders the shared classic card face used across the whole app.
 */
export function PokerCard({ card, small }: { card: number; small?: boolean }) {
  const size = small ? 'sm' : 'md';
  if (card < 0) return <PlayingCardFace faceDown size={size} />;
  return <PlayingCardFace rank={RANK_CHARS[card % 13]} suit={suitOf(card)} size={size} />;
}

export { RANK_CHARS, SUIT_CHARS };
