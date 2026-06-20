import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useCrash } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const TARGETS = [1.5, 2, 3, 5, 10];
const GROWTH = 0.6; // multiplier = e^(GROWTH * seconds)

export function CrashPage() {
  const { data: profile } = useProfile();
  const crash = useCrash();
  const [stake, setStake] = useState(25);
  const [target, setTarget] = useState(2);
  const [mult, setMult] = useState(1);
  const [flying, setFlying] = useState(false);
  const [result, setResult] = useState<{ won: boolean; payout: number; crash: number; target: number } | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;
  const potential = Math.floor(stake * target);

  async function launch() {
    if (flying || tooPoor) return;
    setError(null);
    setResult(null);
    setMult(1);
    setFlying(true);
    try {
      const res = await crash.mutateAsync({ stake, target });
      const endpoint = res.won ? res.target : res.crash;
      const startedAt = performance.now();
      const durationMs = Math.min(6000, (Math.log(Math.max(1.01, endpoint)) / GROWTH) * 1000);

      const tick = (now: number) => {
        const t = Math.min(1, (now - startedAt) / durationMs);
        // Ease the climb from 1.00 up to the endpoint (endpoint^t: 1 → endpoint).
        setMult(Math.pow(endpoint, t));
        if (t < 1) {
          raf.current = requestAnimationFrame(tick);
        } else {
          setMult(endpoint);
          setFlying(false);
          setResult({ won: res.won, payout: res.payout, crash: res.crash, target: res.target });
          if (res.won) setWinId((n) => n + 1);
        }
      };
      raf.current = requestAnimationFrame(tick);
    } catch (e) {
      setFlying(false);
      setError(e instanceof Error ? e.message : 'O lançamento falhou.');
    }
  }

  const busted = result && !result.won;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Crash</h1>
        <p className="mt-2 font-sans text-sm text-muted">Escolha quando sair. Se o foguetão chegar ao seu alvo antes de rebentar, ganha.</p>
      </div>

      <div className="felt felt-rail relative mx-auto flex max-w-md flex-col items-center overflow-hidden rounded-lg px-5 py-12 text-center sm:px-8">
        {result?.won && <WinCelebration key={winId} jackpot={result.target >= 10} />}
        <div className="relative flex h-40 w-full items-center justify-center">
          <span
            className={`font-mono text-6xl font-bold tabular-nums transition-colors ${
              busted ? 'text-negative' : flying ? 'text-gold-light' : result?.won ? 'text-positive' : 'text-text'
            } ${flying ? 'animate-pulse' : 'animate-pop'}`}
            style={{ textShadow: busted ? '0 0 28px rgba(224,85,95,0.5)' : '0 0 28px rgba(201,162,75,0.4)' }}
          >
            {mult.toFixed(2)}×
          </span>
          <span className="absolute right-2 top-1 text-3xl" aria-hidden style={{ opacity: flying ? 1 : busted ? 0 : 0.4 }}>
            {busted ? '💥' : '🚀'}
          </span>
        </div>
        <div className="mt-2 flex min-h-[2.5rem] items-center justify-center px-2">
          {flying ? (
            <p className="font-sans text-sm text-muted">Alvo {target.toFixed(2)}× · a subir…</p>
          ) : result ? (
            result.won ? (
              <p className="animate-pop font-display text-xl font-bold text-positive">
                Saiu a {result.target.toFixed(2)}× — ganhou {formatAmount(result.payout)} tós!
              </p>
            ) : (
              <p className="font-display text-lg font-bold text-negative">Rebentou a {result.crash.toFixed(2)}× — não saiu a tempo.</p>
            )
          ) : (
            <p className="font-sans text-sm text-muted-2">Defina o alvo e lance.</p>
          )}
        </div>
      </div>

      <div className="card mx-auto max-w-md space-y-5 p-5 sm:p-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-2">Sair automaticamente em</p>
            <span className="font-mono text-sm font-semibold text-gold">{target.toFixed(2)}×</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TARGETS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTarget(t)}
                disabled={flying}
                aria-pressed={target === t}
                className={`focus-ring rounded-full border px-3 py-1 font-mono text-xs transition-colors disabled:opacity-40 ${
                  target === t ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted hover:text-text'
                }`}
              >
                {t}×
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1.1}
            max={20}
            step={0.1}
            value={target}
            disabled={flying}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="h-2 w-full cursor-pointer rounded-full accent-gold disabled:opacity-50"
            aria-label="Alvo de saída"
          />
          <p className="mt-1.5 font-sans text-[11px] text-muted-2">
            Prémio se sair: <span className="font-mono text-gold-light">{formatAmount(potential)} tós</span>
          </p>
        </div>
        <div className="space-y-3">
          <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={flying} />
          <Button variant="primary" onClick={launch} disabled={flying || tooPoor} className="w-full">
            {flying ? 'A voar…' : tooPoor ? 'Saldo insuficiente' : `Lançar · ${formatAmount(stake)} tós`}
          </Button>
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      </div>
    </div>
  );
}
