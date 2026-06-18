import { cardRank, cardSuit, RANK_LABELS, SUIT_LABELS } from './blackjack';

interface PlayingCardProps {
  /** Card index 0–51, or null for a face-down card. */
  card: number | null;
}

export function PlayingCard({ card }: PlayingCardProps) {
  if (card === null) {
    return (
      <div className="flex h-20 w-14 items-center justify-center rounded-lg border border-border bg-accent/20">
        <div className="h-14 w-9 rounded bg-accent/40" />
      </div>
    );
  }
  const suit = cardSuit(card);
  const red = suit === 1 || suit === 2; // hearts, diamonds
  return (
    <div className="flex h-20 w-14 flex-col justify-between rounded-lg border border-border bg-white p-1.5 shadow-sm">
      <span className={`text-sm font-bold leading-none ${red ? 'text-negative' : 'text-black'}`}>
        {RANK_LABELS[cardRank(card)]}
      </span>
      <span className={`text-center text-lg leading-none ${red ? 'text-negative' : 'text-black'}`}>
        {SUIT_LABELS[suit]}
      </span>
      <span className={`rotate-180 text-sm font-bold leading-none ${red ? 'text-negative' : 'text-black'}`}>
        {RANK_LABELS[cardRank(card)]}
      </span>
    </div>
  );
}
