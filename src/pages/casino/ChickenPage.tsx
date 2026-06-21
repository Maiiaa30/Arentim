import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useChickenStart, useChickenStep, useChickenCashout } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const DIFFS: { key: string; label: string; s: number }[] = [
  { key: 'easy', label: 'Fácil', s: 0.82 },
  { key: 'medium', label: 'Médio', s: 0.65 },
  { key: 'hard', label: 'Difícil', s: 0.45 },
];
const LANES = 12;
const CURB_W = 74;
const LANE_W = 86;
const HAZARDS = ['🚗', '🚙', '🚕', '🚓', '🚚'];

/** Mirror of SQL chicken_mult (public — only the death lane is hidden). */
function laneMult(step: number, s: number): number {
  return step <= 0 ? 1 : Math.floor(0.97 * Math.pow(1 / s, step) * 100) / 100;
}

export function ChickenPage() {
  const { data: profile } = useProfile();
  const start = useChickenStart();
  const stepRpc = useChickenStep();
  const cashout = useChickenCashout();

  const [stake, setStake] = useState(25);
  const [diff, setDiff] = useState('easy');
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [step, setStep] = useState(0);
  const [mult, setMult] = useState(1);
  const [deadLane, setDeadLane] = useState<number | null>(null);
  const [result, setResult] = useState<{ won: boolean; payout: number } | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const roadRef = useRef<HTMLDivElement>(null);

  const balance = profile?.balance ?? 0;
  const s = DIFFS.find((d) => d.key === diff)!.s;
  const busy = start.isPending || stepRpc.isPending || cashout.isPending;
  const pos = deadLane ?? step;
  const chickenLeft = pos === 0 ? CURB_W / 2 : CURB_W + (pos - 0.5) * LANE_W;

  // Keep the chicken in view as it crosses.
  useEffect(() => {
    const el = roadRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, chickenLeft - el.clientWidth * 0.4), behavior: 'smooth' });
  }, [chickenLeft]);

  async function begin() {
    setError(null);
    if (stake > balance) { setError('Saldo insuficiente.'); return; }
    try {
      await start.mutateAsync({ stake, difficulty: diff });
      setPhase('playing'); setStep(0); setMult(1); setDeadLane(null); setResult(null);
    } catch {
      setError('Não foi possível começar.');
    }
  }

  async function advance() {
    if (phase !== 'playing' || busy) return;
    try {
      const r = await stepRpc.mutateAsync();
      if (!r.alive) {
        setDeadLane(r.lane); setResult({ won: false, payout: 0 }); setPhase('done');
        return;
      }
      setStep(r.lane); setMult(Number(r.multiplier ?? 1));
      if (r.cashed) { setResult({ won: true, payout: r.payout ?? 0 }); setPhase('done'); setWinId((n) => n + 1); }
    } catch {
      setError('Jogada inválida.');
    }
  }

  async function takeMoney() {
    if (phase !== 'playing' || step === 0) return;
    try {
      const r = await cashout.mutateAsync();
      setMult(Number(r.multiplier)); setResult({ won: true, payout: r.payout }); setPhase('done'); setWinId((n) => n + 1);
    } catch {
      setError('A retirada falhou.');
    }
  }

  const cashValue = Math.floor(stake * mult);

  return (
    <div className="animate-fade-in space-y-6">
      {result?.won && <WinCelebration key={winId} jackpot={mult >= 10} />}
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Frango na Estrada</h1>
        <p className="mt-2 font-sans text-sm text-muted">Atravessa as faixas para subir o prémio. Cuidado com o trânsito — retira antes de seres atropelado.</p>
      </div>

      {/* Road */}
      <div ref={roadRef} className="overflow-x-auto rounded-lg border border-black/40 shadow-[inset_0_0_30px_rgba(0,0,0,0.4)]">
        <div className="relative h-[220px]" style={{ width: CURB_W + LANES * LANE_W, background: '#5c5c5c' }}>
          {/* Sidewalk / start */}
          <div
            className="absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-2 border-r-4 border-dashed border-white/30"
            style={{ width: CURB_W, background: 'linear-gradient(180deg,#7a7a6a,#565649)' }}
          >
            <span className="text-2xl">🪙</span>
            <span className="text-xl">🚧</span>
          </div>

          {/* Lanes */}
          {Array.from({ length: LANES }, (_, k) => {
            const lane = k + 1;
            const left = CURB_W + k * LANE_W;
            const passed = lane <= step && phase !== 'idle';
            const dead = deadLane === lane;
            const decoy = !dead && lane % 4 === 0 && lane > step + 1;
            return (
              <div key={lane} className="absolute inset-y-0 border-l-2 border-dashed border-white/25" style={{ left, width: LANE_W }}>
                {/* Manhole multiplier disc */}
                <div
                  className={`absolute left-1/2 top-1/2 flex h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-[12px] font-bold shadow-[inset_0_0_0_3px_rgba(0,0,0,0.45),0_2px_4px_rgba(0,0,0,0.5)] ${passed ? 'text-positive' : 'text-white/90'}`}
                  style={{ background: passed ? 'radial-gradient(circle,#2b6f4e,#10110a)' : 'radial-gradient(circle at 40% 35%,#525252,#1c1c1c)' }}
                >
                  {passed ? '✓' : `${laneMult(lane, s).toFixed(2)}×`}
                </div>
                {dead && <span className="absolute left-1/2 top-1 -translate-x-1/2 text-3xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]">{HAZARDS[lane % HAZARDS.length]}</span>}
                {decoy && <span className="absolute left-1/2 top-2 -translate-x-1/2 text-xl opacity-60">{HAZARDS[lane % HAZARDS.length]}</span>}
              </div>
            );
          })}

          {/* Chicken + multiplier badge */}
          <div className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-300 ease-out" style={{ left: chickenLeft }}>
            <div className="flex flex-col items-center">
              <span className="text-[40px] drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)]">{deadLane != null ? '💥' : '🐔'}</span>
              {phase !== 'idle' && deadLane == null && (
                <span className="mt-0.5 rounded-md bg-[#3b5bdb] px-2 py-0.5 font-mono text-[11px] font-bold text-white shadow-md">{mult.toFixed(2)}×</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-[1.75rem] text-center">
        {phase === 'playing' ? (
          <p className="font-sans text-sm text-muted">Faixa {step} · <span className="font-mono text-gold">{mult.toFixed(2)}×</span> · próxima {laneMult(step + 1, s).toFixed(2)}×</p>
        ) : phase === 'done' && result ? (
          <p className={`font-display text-lg font-bold ${result.won ? 'text-positive' : 'text-negative'}`}>
            {result.won ? `Retiraste ${formatAmount(result.payout)} tós!` : 'Foste atropelado! 🚗'}
          </p>
        ) : null}
      </div>

      {phase === 'playing' ? (
        <div className="mx-auto flex max-w-md gap-3">
          <Button variant="secondary" onClick={advance} disabled={busy} className="flex-1">Atravessar →</Button>
          <Button variant="primary" onClick={takeMoney} disabled={busy || step === 0} className="flex-1">
            Retirar {formatAmount(cashValue)} tós
          </Button>
        </div>
      ) : (
        <div className="card mx-auto max-w-md space-y-4 p-5">
          <div>
            <span className="mb-2 block font-sans text-sm font-medium text-muted">Dificuldade</span>
            <div className="flex gap-2">
              {DIFFS.map((d) => (
                <button key={d.key} onClick={() => setDiff(d.key)}
                  className={`focus-ring rounded px-3 py-1.5 font-sans text-sm ${diff === d.key ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <StakeChips stake={stake} onChange={setStake} balance={balance} />
          <Button variant="primary" onClick={begin} disabled={busy || stake > balance} className="w-full">
            {stake > balance ? 'Saldo insuficiente' : `Jogar · ${formatAmount(stake)} tós`}
          </Button>
          {error && <p className="font-sans text-sm text-negative">{error}</p>}
        </div>
      )}
    </div>
  );
}
