import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useBlackjack, useBlackjackCurrent } from '@/features/casino/useBlackjack';
import { PlayingCard } from '@/features/casino/PlayingCard';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import type { BlackjackView } from '@/types/db';

/** Cards animate in with a small staggered pop as they're dealt. */
function DealtCard({ card, i }: { card: number | null; i: number }) {
  return (
    <span className="inline-block animate-pop" style={{ animationDelay: `${i * 70}ms` }}>
      <PlayingCard card={card} />
    </span>
  );
}

const outcomeLabel: Record<string, { text: string; tone: string }> = {
  win: { text: 'Ganhou', tone: 'text-positive' },
  blackjack: { text: 'Blackjack!', tone: 'text-gold' },
  push: { text: 'Empate', tone: 'text-muted' },
  lose: { text: 'Perdeu', tone: 'text-negative' },
  busted: { text: 'Rebentou', tone: 'text-negative' },
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
      setError(e instanceof Error ? e.message : 'Não foi possível distribuir.');
    }
  }

  async function onAction(action: 'hit' | 'stand' | 'double' | 'split') {
    if (busy || !view) return;
    setError(null);
    try {
      setView(await act.mutateAsync({ handId: view.hand_id, action }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A ação falhou.');
    }
  }

  if (isLoading) return <p className="py-12 text-center text-muted">A carregar…</p>;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[38px] font-medium leading-tight text-text">Blackjack</h1>
        <p className="mt-2 font-sans text-sm text-muted">O croupier pára nos 17 · blackjack paga 3:2</p>
      </div>

      <div className="felt felt-rail relative space-y-8 overflow-hidden rounded-lg p-6">
        {view?.status === 'complete' && view.payout > 0 && (
          <WinCelebration key={view.hand_id} jackpot={view.hands.some((h) => h.status === 'blackjack')} />
        )}
        {view ? (
          <>
            {/* Dealer */}
            <div>
              <p className="mb-2 font-sans text-sm text-muted">
                Croupier {view.dealer_total !== null && <span className="text-text">· {view.dealer_total}</span>}
              </p>
              <div className="flex gap-2">
                {view.dealer.map((c, i) => (
                  <DealtCard key={i} card={c} i={i} />
                ))}
                {view.dealer_hidden && <DealtCard card={null} i={view.dealer.length} />}
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
                    className={`rounded p-3 transition-colors ${
                      isActive ? 'bg-gold/[0.07] ring-1 ring-gold/40' : ''
                    }`}
                  >
                    <p className="mb-2 font-sans text-sm text-muted">
                      {view.hands.length > 1 ? `Mão ${i + 1}` : 'Você'} ·{' '}
                      <span className="text-text">{hand.total}</span>
                      {view.status === 'complete' && oc && (
                        <span className={`ml-2 font-semibold ${oc.tone}`}>{oc.text}</span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      {hand.cards.map((c, j) => (
                        <DealtCard key={j} card={c} i={j} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Result */}
            {view.status === 'complete' && (
              <p className={`text-center font-display text-lg font-bold ${view.payout > 0 ? 'text-positive' : 'text-muted'}`}>
                {view.payout > 0 ? `Devolvido ${formatAmount(view.payout)} Tostões` : 'Sem retorno nesta mão'}
              </p>
            )}

            {/* Actions */}
            {inPlay && view.options && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => onAction('hit')} disabled={busy || !view.options.can_hit}>Pedir</Button>
                <Button variant="secondary" onClick={() => onAction('stand')} disabled={busy || !view.options.can_stand}>
                  Ficar
                </Button>
                <Button variant="secondary" onClick={() => onAction('double')} disabled={busy || !view.options.can_double}>
                  Dobrar
                </Button>
                <Button variant="secondary" onClick={() => onAction('split')} disabled={busy || !view.options.can_split}>
                  Dividir
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="py-8 text-center font-sans text-muted">Faça uma aposta para distribuir.</p>
        )}

        {/* Betting */}
        {showBetting && (
          <div className="space-y-3 border-t border-border pt-6">
            <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={busy} />
            <Button variant="primary" onClick={onDeal} disabled={busy || stake > balance} className="w-full">
              {busy ? 'A distribuir…' : view?.status === 'complete' ? `Distribuir de novo · ${formatAmount(stake)}` : `Distribuir · ${formatAmount(stake)}`}
            </Button>
          </div>
        )}

        {error && <p className="text-center font-sans text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}
