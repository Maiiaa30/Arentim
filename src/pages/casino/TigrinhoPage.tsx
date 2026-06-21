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
  const won = !!result && result.payout > 0;

  async function spin() {
    if (spinning) return;
    setError(null);
    if (stake > balance) { setError('Saldo insuficiente.'); return; }
    setResult(null);
    setWinRows([]);
    setSpinning(true);
    spinTimer.current = window.setInterval(() => setGrid(Array.from({ length: 9 }, randSym)), 70);
    try {
      const r = await play.mutateAsync(stake);
      stopTimer.current = window.setTimeout(() => {
        if (spinTimer.current) window.clearInterval(spinTimer.current);
        setGrid(r.grid);
        setSpinning(false);
        setResult(r);
        setWinRows(r.wins.map((w) => w.row));
        if (r.payout > 0) setWinId((n) => n + 1);
      }, 850);
    } catch {
      if (spinTimer.current) window.clearInterval(spinTimer.current);
      setSpinning(false);
      setError('A jogada falhou.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {won && <WinCelebration key={winId} jackpot={result!.multiplier >= 20} />}

      <div className="text-center">
        <Link to="/casino/slots" className="font-sans text-sm text-muted-2 hover:text-text">← Slots</Link>
        <Eyebrow className="mt-3 !text-[#e0a83a]">A Sorte do Tigre</Eyebrow>
        <h1 className="mt-1 bg-gradient-to-b from-[#ffe9a8] via-[#e0a83a] to-[#b0303a] bg-clip-text font-display text-[40px] font-bold leading-tight text-transparent drop-shadow-[0_2px_10px_rgba(224,168,58,0.3)] sm:text-[52px]">
          🐯 Tigrinho 🐯
        </h1>
        <p className="mt-1 font-sans text-[12.5px] text-muted">Dizem que o tigrinho não paga… só come os tós. Tens coragem? 🔥</p>
      </div>

      {/* Cabinet */}
      <div
        className="relative mx-auto max-w-sm overflow-hidden rounded-[20px] border-[3px] border-[#e0a83a]/70 p-1.5 shadow-[0_0_50px_rgba(224,168,58,0.25),inset_0_0_30px_rgba(0,0,0,0.6)]"
        style={{ background: 'linear-gradient(160deg,#e0a83a,#8a3a14 40%,#5a1414 70%,#2a0a0a)' }}
      >
        <div className="rounded-[14px] p-4" style={{ background: 'radial-gradient(130% 100% at 50% 0%, #6e1a1a, #2a0a0a 75%)' }}>
          {/* ornaments */}
          <div className="pointer-events-none absolute left-2 top-2 text-lg opacity-70">🪙</div>
          <div className="pointer-events-none absolute right-2 top-2 text-lg opacity-70">🧧</div>

          <div className="grid grid-cols-3 gap-2">
            {grid.map((s, i) => {
              const row = Math.floor(i / 3);
              const winning = won && !spinning && winRows.includes(row);
              return (
                <div
                  key={i}
                  className={`flex aspect-square items-center justify-center rounded-xl border-2 text-[44px] transition-all ${
                    winning
                      ? 'animate-pop border-[#ffe9a8] bg-gradient-to-b from-gold/30 to-[#b0303a]/30 shadow-[0_0_20px_rgba(255,233,168,0.7)]'
                      : 'border-[#e0a83a]/25 bg-black/40'
                  } ${spinning ? 'blur-[2px] brightness-110' : ''}`}
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
                >
                  {SYM[s]}
                </div>
              );
            })}
          </div>

          <div className="mt-3 min-h-[2rem] text-center">
            {spinning ? (
              <p className="animate-pulse font-display text-lg font-bold text-[#ffe9a8]">🐯 A rugir…</p>
            ) : result ? (
              won ? (
                <p className="animate-pop font-display text-xl font-bold text-[#ffe9a8]">
                  PAGOU! +{formatAmount(result.payout)} tós · {result.multiplier.toFixed(2)}×
                </p>
              ) : (
                <p className="font-display text-base font-bold text-[#e0555f]">O tigre comeu os teus tós 🐯💸</p>
              )
            ) : (
              <p className="font-sans text-sm text-[#e0a83a]">Gira e reza ao tigre.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card mx-auto max-w-sm space-y-4 p-5">
        <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={spinning} />
        <Button variant="primary" onClick={spin} disabled={spinning || stake > balance} className="w-full !bg-gradient-to-r !from-[#e0a83a] !to-[#b0303a] !text-white">
          {spinning ? 'A rodar…' : stake > balance ? 'Saldo insuficiente' : `GIRAR · ${formatAmount(stake)} tós`}
        </Button>
        <p className="text-center font-sans text-[10px] text-muted-2">⚠️ Probabilidade de ganho baixa — joga por diversão.</p>
        {error && <p className="text-center font-sans text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}
