import { cardRank, cardSuit, RANK_LABELS } from './blackjack';
import { PlayingCardFace } from '@/components/PlayingCardFace';

interface PlayingCardProps {
  /** Card index 0–51, or null for a face-down card. */
  card: number | null;
}

/** Blackjack card → the shared classic card face used across the whole app. */
export function PlayingCard({ card }: PlayingCardProps) {
  if (card === null) return <PlayingCardFace faceDown size="md" />;
  return <PlayingCardFace rank={RANK_LABELS[cardRank(card)]} suit={cardSuit(card)} size="md" />;
}
