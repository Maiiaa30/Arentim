import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useCoinflip } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import type { CoinSide } from '@/features/casino/coinflip';
import { Button } from '@/components/ui/Button';
import { formatAmount } from '@/lib/format';

export function CoinflipPage() {
  const { data: profile } = useProfile();
  const coinflip = useCoinflip();
  const [stake, setStake] = useState(25);
  const [choice, setChoice] = useState<CoinSide>('heads');
  const [outcome, setOutcome] = useState<CoinSide | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = profile?.balance ?? 0;

  async function flip() {
    if (flipping || stake > balance) return;
    setError(null);
    setOutcome(null);
    setWon(null);
    setFlipping(true);
    try {
      const res = await coinflip.mutateAsync({ stake, choice });
      window.setTimeout(() => {
        setOutcome(res.outcome);
        setWon(res.won);
        setFlipping(false);
      }, 700);
    } catch (e) {
      setFlipping(false);
      setError(e instanceof Error ? e.message : 'Flip failed.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="text-sm text-muted hover:text-text">← Casino</Link>
        <h1 className="font-display text-2xl font-bold text-text">Coin flip</h1>
        <p className="mt-1 text-sm text-muted">Double or nothing — call it right and double your stake.</p>
      </div>

      <div className="card mx-auto max-w-md space-y-6 p-6 text-center">
        <div
          className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 border-gold bg-surface text-2xl font-bold text-gold ${
            flipping ? 'animate-spin' : ''
          }`}
        >
          {flipping ? '?' : outcome === null ? '🪙' : outcome === 'heads' ? 'H' : 'T'}
        </div>

        <div className="h-7">
          {won !== null &&
            (won ? (
              <p className="font-display text-lg font-bold text-positive">
                {outcome} — won {formatAmount(stake * 2)} Tostões!
              </p>
            ) : (
              <p className="text-sm text-muted">{outcome} — better luck next flip.</p>
            ))}
        </div>

        <div className="flex justify-center gap-2">
          {(['heads', 'tails'] as const).map((side) => (
            <button
              key={side}
              onClick={() => setChoice(side)}
              disabled={flipping}
              className={`focus-ring flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold capitalize transition-colors disabled:opacity-50 ${
                choice === side ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted hover:text-text'
              }`}
            >
              {side}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={flipping} />
          <Button onClick={flip} disabled={flipping || stake > balance} className="w-full">
            {flipping ? 'Flipping…' : `Flip · ${formatAmount(stake)}`}
          </Button>
          {error && <p className="text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
