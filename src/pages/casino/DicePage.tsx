import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useDice } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import type { DicePick } from '@/features/casino/miniGames';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const PICKS: { id: DicePick; label: string; hint: string; pays: string }[] = [
  { id: 'under', label: 'Menos de 7', hint: '2 – 6', pays: '2.3×' },
  { id: 'seven', label: 'Exatamente 7', hint: '= 7', pays: '5.5×' },
  { id: 'over', label: 'Mais de 7', hint: '8 – 12', pays: '2.3×' },
];

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

function Die({ value, rolling, delay = 0 }: { value: number; rolling: boolean; delay?: number }) {
  return (
    <div
      className={`relative h-20 w-20 rounded-[16px] border border-gold/30 bg-gradient-to-br from-[#f7efe0] to-[#d9cdb4] shadow-[0_6px_16px_rgba(0,0,0,0.5)] ${
        rolling ? 'animate-dice-tumble' : 'animate-pop'
      }`}
      style={rolling ? { animationDelay: `${delay}s` } : undefined}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        {(PIPS[value] ?? PIPS[1]!).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="9" fill="#1a1712" />
        ))}
      </svg>
    </div>
  );
}

export function DicePage() {
  const { data: profile } = useProfile();
  const dice = useDice();
  const [stake, setStake] = useState(25);
  const [pick, setPick] = useState<DicePick>('over');
  const [faces, setFaces] = useState<[number, number]>([2, 5]);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<{ won: boolean; payout: number; sum: number } | null>(null);
  const [spinId, setSpinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  async function roll() {
    if (rolling || tooPoor) return;
    setError(null);
    setResult(null);
    setRolling(true);
    // Tumble the dice while the server rolls.
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
        }, 700),
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
        <p className="mt-2 font-sans text-sm text-muted">Dois dados. Aposte se a soma fica acima, abaixo, ou certa nos sete.</p>
      </div>

      <div className="felt felt-rail relative mx-auto max-w-md overflow-hidden rounded-lg px-5 py-10 text-center sm:px-8">
        {result?.won && <WinCelebration key={spinId} />}
        <div className="flex items-center justify-center gap-5">
          <Die value={faces[0]} rolling={rolling} />
          <Die value={faces[1]} rolling={rolling} delay={-0.18} />
        </div>
        <div className="mt-6 flex min-h-[2.75rem] items-center justify-center px-2">
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
            <p className="font-sans text-sm text-muted-2">Escolha a aposta e lance os dados.</p>
          )}
        </div>
      </div>

      <div className="card mx-auto max-w-md space-y-5 p-5 sm:p-6">
        <div>
          <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">A sua aposta</p>
          <div className="grid grid-cols-3 gap-2.5">
            {PICKS.map((p) => {
              const active = pick === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPick(p.id)}
                  disabled={rolling}
                  aria-pressed={active}
                  className={`focus-ring flex min-h-[68px] flex-col items-center justify-center gap-0.5 rounded border px-2 py-2 font-sans transition-all disabled:opacity-50 ${
                    active ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted hover:text-text'
                  }`}
                >
                  <span className="text-[12.5px] font-semibold leading-tight">{p.label}</span>
                  <span className="font-mono text-[10px] text-muted-2">{p.hint}</span>
                  <span className="font-mono text-[11px] text-gold-light">{p.pays}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={rolling} />
          <Button variant="primary" onClick={roll} disabled={rolling || tooPoor} className="w-full">
            {rolling ? 'A rolar…' : tooPoor ? 'Saldo insuficiente' : `Lançar · ${formatAmount(stake)} tós`}
          </Button>
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
