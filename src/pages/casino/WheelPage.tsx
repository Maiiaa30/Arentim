import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useWheel } from '@/features/casino/useQuickGames';
import { StakeChips } from '@/features/casino/StakeChips';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { WHEEL, wheelColor } from '@/features/casino/miniGames';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const SEG = 360 / WHEEL.length; // 15°
const R = 48;
const CX = 50;
const CY = 50;

/** Point on the wheel at `deg` clockwise from the top (12 o'clock). */
function pt(deg: number, radius: number): [number, number] {
  const t = (deg * Math.PI) / 180;
  return [CX + radius * Math.sin(t), CY - radius * Math.cos(t)];
}

export function WheelPage() {
  const { data: profile } = useProfile();
  const wheel = useWheel();
  const [stake, setStake] = useState(25);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ mult: number; payout: number } | null>(null);
  const [winId, setWinId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const wheelRef = useRef<SVGGElement>(null);
  const rotation = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const balance = profile?.balance ?? 0;
  const tooPoor = stake > balance;

  // Static slices (paths + labels), computed once.
  const slices = useMemo(
    () =>
      WHEEL.map((mult, i) => {
        const a0 = i * SEG;
        const a1 = a0 + SEG;
        const [x0, y0] = pt(a0, R);
        const [x1, y1] = pt(a1, R);
        const [lx, ly] = pt(a0 + SEG / 2, R * 0.66);
        return {
          path: `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
          color: wheelColor(mult),
          mult,
          lx,
          ly,
        };
      }),
    [],
  );

  const SPIN_MS = 4200;

  async function spin() {
    if (spinning || tooPoor) return;
    setError(null);
    setResult(null);
    setSpinning(true);
    try {
      const res = await wheel.mutateAsync(stake);
      // Land the chosen segment's centre under the top pointer: a segment at
      // index i is centred at i*SEG + SEG/2 clockwise from the top, so we rotate
      // the wheel by the negative of that (plus whole spins for drama).
      const center = res.index * SEG + SEG / 2;
      const prev = rotation.current;
      const base = prev - (prev % 360); // normalise
      const target = base + 360 * 6 - center;
      rotation.current = target;

      const el = wheelRef.current;
      el?.getAnimations().forEach((a) => a.cancel());
      el?.animate?.(
        [{ transform: `rotate(${prev}deg)` }, { transform: `rotate(${target}deg)` }],
        { duration: SPIN_MS, easing: 'cubic-bezier(0.16,0.84,0.3,1)', fill: 'forwards' },
      );

      timer.current = window.setTimeout(() => {
        if (el) el.style.transform = `rotate(${target}deg)`;
        setSpinning(false);
        setResult({ mult: res.multiplier, payout: res.payout });
        if (res.payout > 0) setWinId((n) => n + 1);
      }, SPIN_MS);
    } catch (e) {
      setSpinning(false);
      setError(e instanceof Error ? e.message : 'A roda falhou.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Roda da Sorte</h1>
        <p className="mt-2 font-sans text-sm text-muted">Rode a roda e leve o multiplicador onde a seta parar. Até 10× a aposta.</p>
      </div>

      <div className="felt felt-rail relative mx-auto max-w-md overflow-hidden rounded-lg px-5 py-8 text-center sm:px-8">
        {result && result.payout > 0 && <WinCelebration key={winId} jackpot={result.mult >= 10} />}
        <div className="relative mx-auto h-[280px] w-[280px]">
          {/* Pointer */}
          <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2" aria-hidden>
            <div className="h-0 w-0 border-x-[10px] border-t-[18px] border-x-transparent border-t-gold drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" />
          </div>
          <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.55)]">
            <circle cx={CX} cy={CY} r={R + 1.5} fill="#0a0907" stroke="#C9A24B" strokeWidth="1.2" />
            <g ref={wheelRef} style={{ transformOrigin: '50% 50%', transform: `rotate(${rotation.current}deg)` }}>
              {slices.map((s, i) => (
                <g key={i}>
                  <path d={s.path} fill={s.color} stroke="#0a0907" strokeWidth="0.5" />
                  {s.mult > 0 && (
                    <text
                      x={s.lx}
                      y={s.ly}
                      fontSize="5.5"
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={s.mult >= 10 ? '#1a1712' : '#f3edde'}
                      transform={`rotate(${i * SEG + SEG / 2} ${s.lx} ${s.ly})`}
                    >
                      {s.mult}×
                    </text>
                  )}
                </g>
              ))}
            </g>
            <circle cx={CX} cy={CY} r="6" fill="#0a0907" stroke="#C9A24B" strokeWidth="1.2" />
          </svg>
        </div>
        <div className="mt-5 flex min-h-[2.5rem] items-center justify-center px-2">
          {spinning ? (
            <p className="animate-pulse font-display text-lg italic text-gold-light">A rodar…</p>
          ) : result ? (
            result.payout > 0 ? (
              <p className="animate-pop font-display text-xl font-bold text-positive">
                {result.mult}× — ganhou {formatAmount(result.payout)} tós!
              </p>
            ) : (
              <p className="font-sans text-sm text-muted">A seta parou no vazio — gire outra vez.</p>
            )
          ) : (
            <p className="font-sans text-sm text-muted-2">Defina a aposta e gire a roda.</p>
          )}
        </div>
      </div>

      <div className="card mx-auto max-w-md space-y-4 p-5 sm:p-6">
        <StakeChips stake={stake} onChange={setStake} balance={balance} disabled={spinning} />
        <Button variant="primary" onClick={spin} disabled={spinning || tooPoor} className="w-full">
          {spinning ? 'A rodar…' : tooPoor ? 'Saldo insuficiente' : `Rodar · ${formatAmount(stake)} tós`}
        </Button>
        {error && <p className="font-sans text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}
