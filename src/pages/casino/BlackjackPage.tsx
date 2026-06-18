import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useBlackjack, useBlackjackCurrent } from '@/features/casino/useBlackjack';
import { PlayingCard } from '@/features/casino/PlayingCard';
import { StakeChips } from '@/features/casino/StakeChips';
import { Button } from '@/components/ui/Button';
import { formatAmount } from '@/lib/format';
import type { BlackjackView } from '@/types/db';

const outcomeLabel: Record<string, { text: string; tone: string }> = {
  win: { text: 'Win', tone: 'text-positive' },
  blackjack: { text: 'Blackjack!', tone: 'text-gold' },
  push: { text: 'Push', tone: 'text-muted' },
  lose: { text: 'Lose', tone: 'text-negative' },
  busted: { text: 'Bust', tone: 'text-negative' },
};

export function BlackjackPage() {
  const { data: profile } = useProfile();
  const { data: current, isLoading } = useBlackjackCurrent();
  const { deal, act } = useBlackjack();

  const [view, setView] = useState<BlackjackView | null>(null);
  const [stake, setStake] = useState(50);
  const [error, setError] = useState<string | null>(null);

  // Resume an in-progress hand once on load.
  useEffect(() => {
    if (current && !view) setView(current);
  }, [current, view]);

  const balance = profile?.balance ?? 0;
  const busy = deal.isPending || act.isPending;
  const inPlay = view?.status === 'player_turn';
  const showBetting = !view || view.status === 'complete';

  async function onDeal() {
    if (busy || stake > balance) return;
    setError(null);
    try {
      setView(await deal.mutateAsync(stake));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not deal.');
    }
  }

  async function onAction(action: 'hit' | 'stand' | 'double' | 'split') {
    if (busy || !view) return;
    setError(null);
    try {
      setView(await act.mutateAsync({ handId: view.hand_id, action }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    }
  }

  if (isLoading) return <p className="py-12 text-center text-muted">Loading…</p>;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="text-sm text-muted hover:text-text">← Casino</Link>
        <h1 className="font-display text-2xl font-bold text-text">Blackjack</h1>
        <p className="mt-1 text-sm text-muted">Dealer stands on 17 · blackjack pays 3:2</p>
      </div>

      <div className="card space-y-8 p-6">
        {view ? (
          <>
            {/* Dealer */}
            <div>
              <p className="mb-2 text-sm text-muted">
                Dealer {view.dealer_total !== null && <span className="text-text">· {view.dealer_total}</span>}
              </p>
              <div className="flex gap-2">
                {view.dealer.map((c, i) => (
                  <PlayingCard key={i} card={c} />
                ))}
                {view.dealer_hidden && <PlayingCard card={null} />}
              </div>
            </div>

            {/* Player hands */}
            <div className="space-y-4">
              {view.hands.map((hand, i) => {
                const isActive = inPlay && i === view.active;
                const oc = outcomeLabel[hand.status];
                return (
                  <div
                    key={i}
                    className={`rounded-xl p-3 transition-colors ${
                      isActive ? 'bg-accent/10 ring-1 ring-accent/40' : ''
                    }`}
                  >
                    <p className="mb-2 text-sm text-muted">
                      {view.hands.length > 1 ? `Hand ${i + 1}` : 'You'} ·{' '}
                      <span className="text-text">{hand.total}</span>
                      {view.status === 'complete' && oc && (
                        <span className={`ml-2 font-semibold ${oc.tone}`}>{oc.text}</span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      {hand.cards.map((c, j) => (
                        <PlayingCard key={j} card={c} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Result */}
            {view.status === 'complete' && (
              <p className={`text-center font-display text-lg font-bold ${view.payout > 0 ? 'text-positive' : 'text-muted'}`}>
                {view.payout > 0 ? `Returned ${formatAmount(view.payout)} Tostões` : 'No return this hand'}
              </p>
            )}

            {/* Actions */}
            {inPlay && view.options && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => onAction('hit')} disabled={busy || !view.options.can_hit}>Hit</Button>
                <Button variant="secondary" onClick={() => onAction('stand')} disabled={busy || !view.options.can_stand}>
                  Stand
                </Button>
                <Button variant="secondary" onClick={() => onAction('double')} disabled={busy || !view.options.can_double}>
                  Double
                </Button>
                <Button variant="secondary" onClick={() => onAction('split')} disabled={busy || !view.options.can_split}>
                  Split
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-muted">Place a bet to deal.</p>
        )}

        {/* Betting */}
        {showBetting && (
          <div className="space-y-3 border-t border-border pt-6">
            <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={busy} />
            <Button onClick={onDeal} disabled={busy || stake > balance} className="w-full">
              {busy ? 'Dealing…' : view?.status === 'complete' ? `Deal again · ${formatAmount(stake)}` : `Deal · ${formatAmount(stake)}`}
            </Button>
          </div>
        )}

        {error && <p className="text-center text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}
