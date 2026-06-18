import { useState } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import { useBetSlip } from './betSlipStore';
import { usePlaceBet } from './useSportsbook';
import { combineOdds, potentialPayout, selectionLabel, type Market, type Selection } from './odds';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

export function BetSlip() {
  const { items, toggle, clear } = useBetSlip();
  const { data: profile } = useProfile();
  const placeBet = usePlaceBet();
  const [stake, setStake] = useState(50);
  const [msg, setMsg] = useState<string | null>(null);

  const balance = profile?.balance ?? 0;
  const combined = items.length ? combineOdds(items.map((i) => i.odds)) : 0;
  const payout = potentialPayout(stake, combined);
  const isParlay = items.length > 1;

  async function place() {
    setMsg(null);
    if (items.length === 0 || stake <= 0 || stake > balance) return;
    try {
      const res = await placeBet.mutateAsync({
        selections: items.map((i) => ({
          fixture_id: i.fixtureId,
          market: i.market,
          selection: i.selection,
        })),
        stake,
      });
      clear();
      setMsg(`Bet placed — potential return ${formatAmount(res.potential_payout)} Tostões.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not place the bet.');
    }
  }

  return (
    <div className="card sticky top-20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display font-semibold text-text">
          Bet slip {items.length > 0 && <span className="text-muted">· {items.length}</span>}
        </h2>
        {items.length > 0 && (
          <button onClick={clear} className="text-xs text-muted hover:text-text">
            Clear
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Tap odds to add selections.</p>
      ) : (
        <>
          <ul className="mb-3 space-y-2">
            {items.map((i) => (
              <li key={`${i.fixtureId}:${i.market}`} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-text">
                    {selectionLabel(i.market as Market, i.selection as Selection)}
                  </p>
                  <p className="truncate text-xs text-muted">{i.fixtureLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-muted">{i.odds.toFixed(2)}</span>
                  <button
                    onClick={() => toggle(i)}
                    className="text-muted hover:text-negative"
                    aria-label="Remove selection"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="space-y-3 border-t border-border pt-3">
            {isParlay && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">{items.length}-leg parlay odds</span>
                <span className="tabular-nums font-semibold text-text">{combined.toFixed(2)}</span>
              </div>
            )}
            <Input
              id="stake"
              type="number"
              label="Stake"
              min={1}
              value={stake}
              onChange={(e) => setStake(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Potential return</span>
              <span className="flex items-center gap-1 tabular-nums font-semibold text-gold">
                <CoinIcon className="h-3.5 w-3.5" /> {formatAmount(payout)}
              </span>
            </div>
            <Button
              onClick={place}
              disabled={placeBet.isPending || stake <= 0 || stake > balance}
              className="w-full"
            >
              {placeBet.isPending ? 'Placing…' : stake > balance ? 'Insufficient balance' : 'Place bet'}
            </Button>
          </div>
        </>
      )}

      {msg && <p className="mt-3 text-sm text-positive">{msg}</p>}
    </div>
  );
}
