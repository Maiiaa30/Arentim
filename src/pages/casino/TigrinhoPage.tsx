import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useTigrinho } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import type { TigrinhoResult } from '@/types/db';

const SYM = ['🐯', '🪙', '🧧', '🏮', '💰', '🍊'];
const randSym = () => Math.floor(Math.random() * SYM.length);

export function TigrinhoPage() {
  const { data: profile } = useProfile();
  const play = useTigrinho();
  const [stake, setStake] = useState(25);
  const [grid, setGrid] = useState<number[]>([0, 1, 2, 3, 4, 5, 0, 1, 2]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<TigrinhoResult | null>(null);
  const [winRows, setWinRows] = useState<number[]>([]);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const spinTimer = useRef<number | null>(null);
  const stopTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (spinTimer.current) window.clearInterval(spinTimer.current);
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
  }, []);

  const balance = profile?.balance ?? 0;

  async function spin() {
    if (spinning) return;
    setError(null);
    if (stake > balance) { setError('Saldo insuficiente.'); return; }
    setResult(null);
    setWinRows([]);
    setSpinning(true);
    spinTimer.current = window.setInterval(() => {
      setGrid(Array.from({ length: 9 }, randSym));
    }, 80);
    try {
      const r = await play.mutateAsync(stake);
      stopTimer.current = window.setTimeout(() => {
        if (spinTimer.current) window.clearInterval(spinTimer.current);
        setGrid(r.grid);
        setSpinning(false);
        setResult(r);
        setWinRows(r.wins.map((w) => w.row));
        if (r.payout > 0) setWinId((n) => n + 1);
      }, 750);
    } catch {
      if (spinTimer.current) window.clearInterval(spinTimer.current);
      setSpinning(false);
      setError('A jogada falhou.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {result && result.payout > 0 && <WinCelebration key={winId} jackpot={result.multiplier >= 20} />}
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Tigrinho</h1>
        <p className="mt-2 font-sans text-sm text-muted">A slot do tigre da sorte. Três iguais numa linha pagam — o tigre 🐯 é o prémio maior.</p>
      </div>

      <div
        className="relative mx-auto max-w-sm overflow-hidden rounded-2xl border-2 border-gold/50 p-5 shadow-[0_0_40px_rgba(201,162,75,0.15)]"
        style={{ background: 'radial-gradient(120% 90% at 50% 0%, #5a1414, #2a0a0a 70%, #1a0707)' }}
      >
        <div className="grid grid-cols-3 gap-2">
          {grid.map((s, i) => {
            const row = Math.floor(i / 3);
            const winning = !spinning && winRows.includes(row);
            return (
              <div
                key={i}
                className={`flex aspect-square items-center justify-center rounded-lg border text-4xl transition-all ${
                  winning ? 'animate-pop border-gold bg-gold/20 shadow-[0_0_16px_rgba(201,162,75,0.5)]' : 'border-gold/20 bg-black/30'
                } ${spinning ? 'blur-[1px]' : ''}`}
              >
                {SYM[s]}
              </div>
            );
          })}
        </div>

        <div className="mt-4 min-h-[1.75rem] text-center">
          {spinning ? (
            <p className="font-sans text-sm text-gold-light">A rodar…</p>
          ) : result ? (
            result.payout > 0 ? (
              <p className="animate-pop font-display text-lg font-bold text-gold">
                Ganhaste {formatAmount(result.payout)} tós · {result.multiplier.toFixed(2)}×
              </p>
            ) : (
              <p className="font-sans text-sm text-muted">Sem sorte. Gira outra vez.</p>
            )
          ) : (
            <p className="font-sans text-sm text-muted-2">Gira para chamar o tigre.</p>
          )}
        </div>
      </div>

      <div className="card mx-auto max-w-sm space-y-4 p-5">
        <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={spinning} />
        <Button variant="primary" onClick={spin} disabled={spinning || stake > balance} className="w-full">
          {spinning ? 'A rodar…' : stake > balance ? 'Saldo insuficiente' : `Girar · ${formatAmount(stake)} tós`}
        </Button>
        {error && <p className="font-sans text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}
