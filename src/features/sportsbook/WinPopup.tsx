import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useMyBets } from './useSportsbook';
import { LAST_BET_SEEN_KEY, maxBetId, unseenWins } from './betStats';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { formatAmount } from '@/lib/format';

function readLastSeen(): number {
  try {
    const raw = localStorage.getItem(LAST_BET_SEEN_KEY);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeLastSeen(id: number) {
  try {
    localStorage.setItem(LAST_BET_SEEN_KEY, String(id));
  } catch {
    /* private mode / storage disabled — non-fatal */
  }
}

/**
 * Celebratory modal shown on the home page when the user has bets that settled
 * as `won` since their last visit. "Last seen" is the highest settled bet id
 * stored in localStorage, so each win is celebrated exactly once. Dismissing
 * (or opening the slip) marks everything currently won as seen.
 */
export function WinPopup() {
  const { data: bets } = useMyBets();
  // Snapshot the high-water mark once on mount so a background refetch that adds
  // new wins mid-session doesn't surprise the user with a popup while browsing.
  const [lastSeen] = useState(readLastSeen);
  const [dismissed, setDismissed] = useState(false);

  const wins = useMemo(() => unseenWins(bets ?? [], lastSeen), [bets, lastSeen]);
  const open = !dismissed && wins.length > 0;

  // Once we have data, advance the high-water mark past every won bet so the
  // popup never re-appears for these — even if the user dismisses without acting.
  useEffect(() => {
    if (!bets || bets.length === 0) return;
    const top = maxBetId(bets.filter((b) => b.status === 'won'));
    if (top > lastSeen) writeLastSeen(top);
  }, [bets, lastSeen]);

  if (!open) return null;

  const totalPayout = wins.reduce((sum, b) => sum + b.potential_payout, 0);
  const totalStake = wins.reduce((sum, b) => sum + b.stake, 0);
  const headline = wins[0]!;

  function close() {
    setDismissed(true);
  }

  return createPortal(
    <>
      <WinCelebration jackpot={wins.length > 1 || totalPayout >= 1000} />
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="win-popup-title"
      >
        <button
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          aria-label="Fechar"
          onClick={close}
        />
        <div
          className="relative w-full max-w-sm overflow-hidden rounded-lg border border-gold/40 p-6 text-center shadow-2xl"
          style={{ background: 'linear-gradient(150deg,#16120b 0%,#0d0b07 60%,#0c0f0c 100%)' }}
        >
          <span
            className="absolute left-4 top-4 h-5 w-5 border-l border-t border-gold/60"
            aria-hidden
          />
          <span
            className="absolute bottom-4 right-4 h-5 w-5 border-b border-r border-gold/60"
            aria-hidden
          />

          <p className="font-sans text-[10.5px] font-medium uppercase tracking-[0.22em] text-gold">
            {wins.length > 1 ? `${wins.length} apostas ganhas` : 'Aposta ganha'}
          </p>
          <h2
            id="win-popup-title"
            className="mt-2 font-display text-[34px] font-medium leading-tight text-text"
          >
            Ganhou!
          </h2>

          <div className="mt-5 rounded border border-gold/30 bg-bg/40 px-4 py-4">
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">
              Retorno total
            </p>
            <p className="mt-1 font-mono text-3xl font-semibold text-positive">
              {formatAmount(totalPayout)}
              <span className="ml-1 font-sans text-sm text-muted-2">tós</span>
            </p>
            <p className="mt-2 font-sans text-xs text-muted-2">
              {wins.length > 1
                ? `${wins.length} apostas · ${formatAmount(totalStake)} apostados`
                : `${headline.legs.length > 1 ? `Múltipla de ${headline.legs.length}` : 'Simples'} · cotação ${Number(headline.combined_odds).toFixed(2)} · ${formatAmount(headline.stake)} apostados`}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link to="/sportsbook" onClick={close} className="flex-1">
              <Button variant="primary" className="w-full">
                Ver apostas
              </Button>
            </Link>
            <Button variant="secondary" onClick={close} className="flex-1">
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
