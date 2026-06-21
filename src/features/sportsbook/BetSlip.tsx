import { useState } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import { useBetSlip } from './betSlipStore';
import { usePlaceBet } from './useSportsbook';
import { combineOdds, potentialPayout, selectionLabel, type Market, type Selection } from './odds';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount, formatTos } from '@/lib/format';

const CHIPS = [-10, 10, 50];

export function BetSlip() {
  const { items, toggle, clear } = useBetSlip();
  const { data: profile } = useProfile();
  const placeBet = usePlaceBet();
  const [stake, setStake] = useState(25);
  const [msg, setMsg] = useState<{ text: string; tone: 'win' | 'loss' | 'info' } | null>(null);

  const balance = profile?.balance ?? 0;
  const combined = items.length ? combineOdds(items.map((i) => i.odds)) : 0;
  const payout = potentialPayout(stake, combined);
  const isParlay = items.length > 1;
  const overStake = stake > balance;

  function adjust(delta: number) {
    setStake((s) => Math.max(0, s + delta));
  }

  async function place() {
    setMsg(null);
    if (items.length === 0 || stake <= 0 || overStake) return;
    try {
      // One key per submission, reused across any auto-retry so the server
      // can't double-debit the same slip (audit H1).
      const res = await placeBet.mutateAsync({
        selections: items.map((i) => ({ fixture_id: i.fixtureId, market: i.market, selection: i.selection })),
        stake,
        idempotencyKey: crypto.randomUUID(),
      });
      clear();
      setMsg({ text: `Aposta registada — retorno potencial ${formatTos(res.potential_payout)}.`, tone: 'win' });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Não foi possível registar a aposta.', tone: 'loss' });
    }
  }

  return (
    <div className="card sticky top-[92px] border-border-strong p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-xl font-medium text-text">Boletim</h3>
        {items.length > 0 && (
          <span className="rounded-full bg-gold px-2.5 py-0.5 font-mono text-xs font-medium text-bg">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-muted-2">
          O seu boletim está vazio. Toque numa cotação para adicionar.
        </p>
      ) : (
        <>
          <ul className="mb-4 space-y-3">
            {items.map((i) => (
              <li key={`${i.fixtureId}:${i.market}`} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-sans text-sm text-body">
                    {selectionLabel(i.market as Market, i.selection as Selection)}
                  </p>
                  <p className="truncate font-sans text-xs text-muted-2">{i.fixtureLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gold">{i.odds.toFixed(2)}</span>
                  <button onClick={() => toggle(i)} className="text-muted-2 hover:text-negative" aria-label="Remover">
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="space-y-3 border-t border-border pt-4">
            <div>
              <label htmlFor="stake" className="mb-1 block font-sans text-[10.5px] uppercase tracking-[0.18em] text-muted-2">
                Aposta
              </label>
              <input
                id="stake"
                type="number"
                min={1}
                value={stake}
                onChange={(e) => setStake(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="focus-ring w-full rounded border border-border bg-bg px-3 py-2.5 font-mono text-sm text-body focus:border-gold"
              />
              <div className="mt-2 flex gap-1.5">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => adjust(c)}
                    className="focus-ring flex-1 rounded border border-border py-1.5 font-mono text-xs text-muted hover:border-gold hover:text-gold"
                  >
                    {c > 0 ? `+${c}` : c}
                  </button>
                ))}
                <button
                  onClick={() => setStake(balance)}
                  className="focus-ring flex-1 rounded border border-border py-1.5 font-sans text-xs uppercase tracking-wider text-muted hover:border-gold hover:text-gold"
                >
                  Máx
                </button>
              </div>
            </div>

            {isParlay && (
              <div className="flex justify-between font-sans text-sm">
                <span className="text-muted-2">Cotação total</span>
                <span className="font-mono font-medium text-text">{combined.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between font-sans text-sm">
              <span className="text-muted-2">Retorno potencial</span>
              <span className="flex items-center gap-1 font-mono font-medium text-positive">
                <CoinIcon className="h-3.5 w-3.5" /> {formatAmount(payout)}
              </span>
            </div>

            {overStake && <p className="text-sm text-negative">A aposta excede o seu saldo.</p>}

            <Button
              variant="primary"
              onClick={place}
              disabled={placeBet.isPending || stake <= 0 || overStake}
              className="w-full"
            >
              {placeBet.isPending ? 'A registar…' : 'Apostar'}
            </Button>
          </div>
        </>
      )}

      {msg && (
        <p className={`mt-3 text-sm ${msg.tone === 'loss' ? 'text-negative' : 'text-positive'}`}>{msg.text}</p>
      )}
    </div>
  );
}
