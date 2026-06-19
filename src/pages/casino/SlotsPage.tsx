import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useSlots } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { REEL_STRIP, SYMBOL_LABEL, type SlotSymbol } from '@/features/casino/slots';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

function Reel({ symbol, spinning }: { symbol: SlotSymbol; spinning: boolean }) {
  const [shown, setShown] = useState<SlotSymbol>(symbol);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (spinning) {
      ref.current = window.setInterval(() => {
        setShown(REEL_STRIP[Math.floor(Math.random() * REEL_STRIP.length)]!);
      }, 80);
      return () => { if (ref.current) window.clearInterval(ref.current); };
    }
    setShown(symbol);
    return;
  }, [spinning, symbol]);

  return (
    <div
      className={`flex h-24 w-24 items-center justify-center rounded border border-border bg-bg text-5xl transition-transform ${
        spinning ? 'animate-pulse' : ''
      }`}
    >
      {SYMBOL_LABEL[shown]}
    </div>
  );
}

export function SlotsPage() {
  const { data: profile } = useProfile();
  const slots = useSlots();
  const [stake, setStake] = useState(25);
  const [reels, setReels] = useState<SlotSymbol[]>(['coin', 'seven', 'galo']);
  const [spinning, setSpinning] = useState(false);
  const [payout, setPayout] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const settleTimer = useRef<number | null>(null);

  useEffect(() => () => { if (settleTimer.current) window.clearTimeout(settleTimer.current); }, []);

  const balance = profile?.balance ?? 0;

  async function spin() {
    if (spinning || stake > balance) return;
    setError(null);
    setPayout(null);
    setSpinning(true);
    try {
      const res = await slots.mutateAsync(stake);
      settleTimer.current = window.setTimeout(() => {
        setReels(res.reels as SlotSymbol[]);
        setSpinning(false);
        setPayout(res.payout);
      }, 900);
    } catch (e) {
      setSpinning(false);
      setError(e instanceof Error ? e.message : 'A jogada falhou.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/" className="font-sans text-sm text-muted-2 hover:text-text">← Voltar às Mesas</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[38px] font-medium leading-tight text-text">Slots</h1>
      </div>

      <div className="card mx-auto max-w-md space-y-6 p-6 text-center">
        <div className="flex justify-center gap-3">
          {reels.map((s, i) => (
            <Reel key={i} symbol={s} spinning={spinning} />
          ))}
        </div>

        <div className="h-7">
          {payout !== null &&
            (payout > 0 ? (
              <p className="font-display text-lg font-bold text-positive">
                Ganhou {formatAmount(payout)} Tostões!
              </p>
            ) : (
              <p className="font-sans text-sm text-muted">Sem prémio — rode outra vez.</p>
            ))}
        </div>

        <div className="space-y-3">
          <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={spinning} />
          <Button variant="primary" onClick={spin} disabled={spinning || stake > balance} className="w-full">
            {spinning ? 'A rodar…' : `Rodar · ${formatAmount(stake)}`}
          </Button>
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>

        <p className="font-mono text-xs text-muted-2">
          🪙×3 = 100× · 7×3 = 40× · 🐓×3 = 18× · 🍷×3 = 13× · 🐟×3 = 7× · pares de 🪙/7 também pagam
        </p>
      </div>
    </div>
  );
}
