import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useBlackjack, useBlackjackCurrent } from '@/features/casino/useBlackjack';
import { BlackjackTable } from '@/features/casino/BlackjackTable';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import type { BlackjackView } from '@/types/db';

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
  const complete = view?.status === 'complete';
  const showBetting = !view || complete;
  const won = complete && view.payout > 0;
  const isBlackjackWin = complete && view.hands.some((h) => h.status === 'blackjack');

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
      {won && <WinCelebration key={view.hand_id} jackpot={isBlackjackWin} />}

      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[38px] font-medium leading-tight text-text">Blackjack</h1>
        <p className="mt-2 font-sans text-sm text-muted">O croupier pára nos 17 · blackjack paga 3:2</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* The felt table */}
        <BlackjackTable view={view} inPlay={!!inPlay} pendingStake={view ? 0 : stake}>
          {/* Result banner */}
          {complete && (
            <div className="text-center">
              <p
                className={`font-display text-xl font-bold ${won ? 'text-positive' : 'text-muted'}`}
              >
                {won
                  ? `Devolvido ${formatAmount(view.payout)} Tostões`
                  : 'Sem retorno nesta mão'}
              </p>
            </div>
          )}

          {/* In-play actions, anchored to the felt */}
          {inPlay && view?.options && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => onAction('hit')} disabled={busy || !view.options.can_hit}>
                Pedir
              </Button>
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

          {!view && (
            <p className="text-center font-sans text-sm text-emerald-100/55">
              Escolha a aposta e distribua para começar.
            </p>
          )}
        </BlackjackTable>

        {/* Side rail — betting + house rules */}
        <div className="space-y-4">
          <div className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm uppercase tracking-[0.16em] text-muted">
                {complete ? 'Nova mão' : 'A sua aposta'}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-gold-light">
                {formatAmount(stake)}
              </span>
            </div>

            {showBetting ? (
              <>
                <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={busy} />
                <Button
                  variant="primary"
                  onClick={onDeal}
                  disabled={busy || stake > balance}
                  className="w-full"
                >
                  {busy
                    ? 'A distribuir…'
                    : complete
                      ? `Distribuir de novo · ${formatAmount(stake)}`
                      : `Distribuir · ${formatAmount(stake)}`}
                </Button>
                {stake > balance && (
                  <p className="font-sans text-xs text-negative">Tostões insuficientes para esta aposta.</p>
                )}
              </>
            ) : (
              <p className="font-sans text-sm text-muted">
                Mão a decorrer — use as ações na mesa.
              </p>
            )}

            {error && <p className="font-sans text-sm text-negative">{error}</p>}
          </div>

          <div className="card space-y-2 p-5">
            <span className="font-display text-sm uppercase tracking-[0.16em] text-muted">Regras da casa</span>
            <ul className="space-y-1.5 font-sans text-sm text-muted">
              <li className="flex justify-between gap-3">
                <span>Blackjack paga</span>
                <span className="font-mono font-semibold text-gold-light">3:2</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Croupier pára nos</span>
                <span className="font-mono font-semibold text-gold-light">17</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Vitória paga</span>
                <span className="font-mono font-semibold text-gold-light">1:1</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
