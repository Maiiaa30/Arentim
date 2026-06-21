import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useDice } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import type { DicePick } from '@/features/casino/miniGames';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const PICKS: { id: DicePick; label: string; hint: string; pays: string; tone: string }[] = [
  { id: 'under', label: '▼ Menos de 7', hint: 'soma 2 – 6', pays: '2.3×', tone: 'negative' },
  { id: 'seven', label: '● Exatamente 7', hint: 'soma = 7', pays: '5.5×', tone: 'gold' },
  { id: 'over', label: '▲ Mais de 7', hint: 'soma 8 – 12', pays: '2.3×', tone: 'positive' },
];

const SUMS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 27], [70, 27], [30, 50], [70, 50], [30, 73], [70, 73]],
};

function Die({ value, rolling, delay = 0 }: { value: number; rolling: boolean; delay?: number }) {
  return (
    <div
      className={`relative h-24 w-24 rounded-[20px] ${rolling ? 'animate-dice-tumble' : 'animate-pop'}`}
      style={{
        background: 'radial-gradient(120% 120% at 30% 25%, #fffdf6, #efe6d2 55%, #cdbf9f)',
        boxShadow: '0 10px 22px rgba(0,0,0,0.55), inset 0 2px 3px rgba(255,255,255,0.7), inset 0 -6px 10px rgba(120,100,60,0.25)',
        ...(rolling ? { animationDelay: `${delay}s` } : {}),
      }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        {(PIPS[value] ?? PIPS[1]!).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="8.5" fill="#1a1712" />
        ))}
      </svg>
    </div>
  );
}

function SumTrack({ sum }: { sum: number | null }) {
  return (
    <div className="flex justify-center gap-1.5">
      {SUMS.map((s) => {
        const over = s > 7;
        const seven = s === 7;
        const active = sum === s;
        const base = seven ? 'rgba(201,162,75,0.5)' : over ? 'rgba(43,111,78,0.5)' : 'rgba(176,48,58,0.5)';
        return (
          <div key={s} className="flex flex-col items-center gap-1">
            <span className={`font-mono text-[11px] ${active ? 'font-bold text-gold' : 'text-muted-2'}`}>{s}</span>
            <span
              className={`h-7 w-3.5 rounded-full transition-all ${active ? 'scale-y-125 shadow-[0_0_14px_rgba(201,162,75,0.7)]' : ''}`}
              style={{ background: active ? '#C9A24B' : base, opacity: active ? 1 : 0.55 }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function DicePage() {
  const { data: profile } = useProfile();
  const dice = useDice();
  const [stake, setStake] = useState(25);
  const [faces, setFaces] = useState<[number, number]>([2, 5]);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<{ won: boolean; payout: number; sum: number } | null>(null);
  const [spinId, setSpinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  async function roll(pick: DicePick) {
    if (rolling || tooPoor) return;
    setError(null);
    setResult(null);
    setRolling(true);
    const shuffle = window.setInterval(
      () => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)] as [number, number]),
      80,
    );
    try {
      const res = await dice.mutateAsync({ stake, pick });
      timers.current.push(
        window.setTimeout(() => {
          window.clearInterval(shuffle);
          setFaces(res.dice);
          setRolling(false);
          setResult({ won: res.won, payout: res.payout, sum: res.sum });
          if (res.won) setSpinId((n) => n + 1);
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
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Dados</h1>
        <p className="mt-2 font-sans text-sm text-muted">Dois dados. Aposte se a soma fica abaixo, acima, ou certa nos sete.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* ---- Game ---- */}
        <div className="felt felt-rail relative overflow-hidden rounded-lg px-5 py-10 text-center sm:px-8">
          {result?.won && <WinCelebration key={spinId} />}
          <div className="flex items-center justify-center gap-6">
            <Die value={faces[0]} rolling={rolling} />
            <Die value={faces[1]} rolling={rolling} delay={-0.18} />
          </div>

          <div className="mt-8">
            <SumTrack sum={rolling ? null : result?.sum ?? null} />
            <div className="mt-3 flex justify-between px-1 font-sans text-[9px] uppercase tracking-[0.18em]">
              <span className="text-negative/80">Menos de 7</span>
              <span className="text-gold/80">7</span>
              <span className="text-positive/80">Mais de 7</span>
            </div>
          </div>

          <div className="mt-6 flex min-h-[2.25rem] items-center justify-center px-2">
            {rolling ? (
              <p className="animate-pulse font-display text-lg italic text-gold-light">A rolar…</p>
            ) : result ? (
              result.won ? (
                <p className="animate-pop font-display text-xl font-bold text-positive">
                  Soma {result.sum} — ganhou {formatAmount(result.payout)} tós!
                </p>
              ) : (
                <p className="font-sans text-sm text-muted">Soma {result.sum} — mais sorte para a próxima.</p>
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
          <div className="space-y-2.5">
            {PICKS.map((p) => {
              const color = p.tone === 'positive' ? 'text-positive border-positive/40 bg-positive-felt/15 hover:bg-positive-felt/25'
                : p.tone === 'negative' ? 'text-negative border-negative/40 bg-negative/10 hover:bg-negative/20'
                : 'text-gold border-gold/40 bg-gold/10 hover:bg-gold/15';
              return (
                <button
                  key={p.id}
                  onClick={() => roll(p.id)}
                  disabled={rolling || tooPoor}
                  className={`focus-ring flex w-full items-center justify-between rounded-lg border px-4 py-3.5 transition-colors disabled:opacity-40 ${color}`}
                >
                  <span className="flex flex-col items-start">
                    <span className="font-display text-lg font-bold">{p.label}</span>
                    <span className="font-sans text-[11px] text-muted-2">{p.hint}</span>
                  </span>
                  <span className="font-mono text-xl font-bold text-gold-light">{p.pays}</span>
                </button>
              );
            })}
          </div>
          {tooPoor && <p className="font-sans text-sm text-negative">Saldo insuficiente para esta aposta.</p>}
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
