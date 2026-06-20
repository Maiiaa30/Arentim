import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useSobeDesce } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import type { HiLoPick } from '@/features/casino/miniGames';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const PICKS: { id: HiLoPick; label: string; hint: string; pays: string }[] = [
  { id: 'sobe', label: 'Sobe', hint: '8 – 13', pays: '2×' },
  { id: 'sete', label: 'Sete', hint: '= 7', pays: '12×' },
  { id: 'desce', label: 'Desce', hint: '1 – 6', pays: '2×' },
];

const RUNGS = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export function SobeDescePage() {
  const { data: profile } = useProfile();
  const game = useSobeDesce();
  const [stake, setStake] = useState(25);
  const [pick, setPick] = useState<HiLoPick>('sobe');
  const [marker, setMarker] = useState(7);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<{ won: boolean; payout: number; n: number } | null>(null);
  const [spinId, setSpinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  async function play() {
    if (rolling || tooPoor) return;
    setError(null);
    setResult(null);
    setRolling(true);
    const shuffle = window.setInterval(() => setMarker(1 + Math.floor(Math.random() * 13)), 70);
    try {
      const res = await game.mutateAsync({ stake, pick });
      timers.current.push(
        window.setTimeout(() => {
          window.clearInterval(shuffle);
          setMarker(res.number);
          setRolling(false);
          setResult({ won: res.won, payout: res.payout, n: res.number });
          if (res.won) setSpinId((n) => n + 1);
        }, 850),
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
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Sobe e Desce</h1>
        <p className="mt-2 font-sans text-sm text-muted">A marca sobe a escada e pára num número de 1 a 13. Aposte para que lado vai.</p>
      </div>

      <div className="felt felt-rail relative mx-auto max-w-md overflow-hidden rounded-lg px-5 py-8 sm:px-8">
        {result?.won && <WinCelebration key={spinId} />}
        <div className="mx-auto flex max-w-[260px] flex-col gap-1">
          {RUNGS.map((n) => {
            const here = marker === n;
            const isSeven = n === 7;
            const zone = n > 7 ? 'sobe' : n < 7 ? 'desce' : 'sete';
            return (
              <div
                key={n}
                className={`flex items-center justify-between rounded border px-3 py-1.5 transition-all duration-150 ${
                  here
                    ? 'scale-[1.04] border-gold bg-gold/20 shadow-[0_0_18px_rgba(201,162,75,0.4)]'
                    : isSeven
                      ? 'border-gold/30 bg-gold/[0.06]'
                      : 'border-border/60 bg-black/20'
                }`}
              >
                <span className={`font-mono text-sm font-semibold ${here ? 'text-gold' : isSeven ? 'text-gold-light' : 'text-muted'}`}>{n}</span>
                <span className="font-sans text-[9px] uppercase tracking-[0.16em] text-muted-2">
                  {here ? '◀ marca' : zone === 'sobe' ? 'sobe' : zone === 'desce' ? 'desce' : 'sete'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex min-h-[2.5rem] items-center justify-center px-2 text-center">
          {rolling ? (
            <p className="animate-pulse font-display text-lg italic text-gold-light">A subir…</p>
          ) : result ? (
            result.won ? (
              <p className="animate-pop font-display text-xl font-bold text-positive">
                Parou no {result.n} — ganhou {formatAmount(result.payout)} tós!
              </p>
            ) : (
              <p className="font-sans text-sm text-muted">Parou no {result.n} — não foi desta.</p>
            )
          ) : (
            <p className="font-sans text-sm text-muted-2">Escolha o sentido e jogue.</p>
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
                  <span className="text-[13px] font-semibold leading-tight">{p.label}</span>
                  <span className="font-mono text-[10px] text-muted-2">{p.hint}</span>
                  <span className="font-mono text-[11px] text-gold-light">{p.pays}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={rolling} />
          <Button variant="primary" onClick={play} disabled={rolling || tooPoor} className="w-full">
            {rolling ? 'A jogar…' : tooPoor ? 'Saldo insuficiente' : `Jogar · ${formatAmount(stake)} tós`}
          </Button>
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
