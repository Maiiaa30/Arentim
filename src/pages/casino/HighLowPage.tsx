import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useHighLow } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import type { HighLowPick } from '@/features/casino/miniGames';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 27], [70, 27], [30, 50], [70, 50], [30, 73], [70, 73]],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div
      className={`relative h-28 w-28 rounded-[22px] ${rolling ? 'animate-dice-tumble' : 'animate-pop'}`}
      style={{
        background: 'radial-gradient(120% 120% at 30% 25%, #fffdf6, #efe6d2 55%, #cdbf9f)',
        boxShadow: '0 12px 26px rgba(0,0,0,0.55), inset 0 2px 3px rgba(255,255,255,0.7), inset 0 -7px 12px rgba(120,100,60,0.25)',
      }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        {(PIPS[value] ?? PIPS[1]!).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="9.5" fill="#1a1712" />
        ))}
      </svg>
    </div>
  );
}

export function HighLowPage() {
  const { data: profile } = useProfile();
  const game = useHighLow();
  const [stake, setStake] = useState(25);
  const [face, setFace] = useState(3);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<{ won: boolean; payout: number; die: number } | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  async function roll(pick: HighLowPick) {
    if (rolling || tooPoor) return;
    setError(null);
    setResult(null);
    setRolling(true);
    const shuffle = window.setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 80);
    try {
      const res = await game.mutateAsync({ stake, pick });
      timers.current.push(
        window.setTimeout(() => {
          window.clearInterval(shuffle);
          setFace(res.die);
          setRolling(false);
          setResult({ won: res.won, payout: res.payout, die: res.die });
          if (res.won) setWinId((n) => n + 1);
        }, 750),
      );
    } catch (e) {
      window.clearInterval(shuffle);
      setRolling(false);
      setError(e instanceof Error ? e.message : 'A jogada falhou.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Maior ou Menor</h1>
        <p className="mt-2 font-sans text-sm text-muted">Um dado. Aposte Menor (1–3) ou Maior (4–6) a 1.9×, ou acerte no número a 5.7×.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* ---- Game ---- */}
        <div className="felt felt-rail relative flex flex-col items-center overflow-hidden rounded-lg px-5 py-12 text-center sm:px-8">
          {result?.won && <WinCelebration key={winId} jackpot={result.payout >= stake * 5} />}
          <Die value={face} rolling={rolling} />
          <div className="mt-7 flex min-h-[2.5rem] items-center justify-center px-2">
            {rolling ? (
              <p className="animate-pulse font-display text-lg italic text-gold-light">A rolar…</p>
            ) : result ? (
              result.won ? (
                <p className="animate-pop font-display text-xl font-bold text-positive">
                  Saiu {result.die} — ganhou {formatAmount(result.payout)} tós!
                </p>
              ) : (
                <p className="font-sans text-sm text-muted">Saiu {result.die} — não foi desta.</p>
              )
            ) : (
              <p className="font-sans text-sm text-muted-2">Escolha a aposta para lançar.</p>
            )}
          </div>
        </div>

        {/* ---- Bet ---- */}
        <div className="card space-y-5 p-5 sm:p-6">
          <div>
            <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">Aposta</p>
            <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={rolling} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => roll('low')}
              disabled={rolling || tooPoor}
              className="focus-ring flex flex-col items-center rounded-lg border border-negative/40 bg-negative/10 px-4 py-3.5 transition-colors hover:bg-negative/20 disabled:opacity-40"
            >
              <span className="font-display text-lg font-bold text-negative">Menor</span>
              <span className="font-mono text-[11px] text-muted-2">1 – 3 · 1.9×</span>
            </button>
            <button
              onClick={() => roll('high')}
              disabled={rolling || tooPoor}
              className="focus-ring flex flex-col items-center rounded-lg border border-positive/40 bg-positive-felt/15 px-4 py-3.5 transition-colors hover:bg-positive-felt/25 disabled:opacity-40"
            >
              <span className="font-display text-lg font-bold text-positive">Maior</span>
              <span className="font-mono text-[11px] text-muted-2">4 – 6 · 1.9×</span>
            </button>
          </div>
          <div>
            <p className="mb-2 font-sans text-[11px] text-muted-2">Ou acerte no número exato — paga 5.7×</p>
            <div className="grid grid-cols-6 gap-1.5">
              {(['1', '2', '3', '4', '5', '6'] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => roll(n)}
                  disabled={rolling || tooPoor}
                  className="focus-ring flex aspect-square items-center justify-center rounded border border-border bg-bg font-mono text-sm font-bold text-text transition-colors hover:border-gold hover:text-gold disabled:opacity-40"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {tooPoor && <p className="font-sans text-sm text-negative">Saldo insuficiente para esta aposta.</p>}
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
