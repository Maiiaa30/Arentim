import { useEffect, useRef, useState } from 'react';
import { useSpinSegments, useDailySpinStatus, useDailySpin } from './useDailyWheel';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount, formatTostoes } from '@/lib/format';

const SEG_DEG = 45; // 8 segments
const SPIN_MS = 4200;
const COLORS = ['#1a1712', '#C9A24B'];

/** Point on a circle, measuring `deg` clockwise from the top (12 o'clock). */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function segmentPath(cx: number, cy: number, r: number, i: number): string {
  const [sx, sy] = polar(cx, cy, r, i * SEG_DEG);
  const [ex, ey] = polar(cx, cy, r, (i + 1) * SEG_DEG);
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey} Z`;
}

/** Live "renova em HH:MM:SS" until the wheel resets. */
function resetIn(resetsAt: string, now: number): string {
  const ms = Math.max(0, new Date(resetsAt).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function SpinWheel() {
  const { data: segments = [] } = useSpinSegments();
  const { data: status } = useDailySpinStatus();
  const spin = useDailySpin();

  const wheelRef = useRef<SVGSVGElement>(null);
  const rotationRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ amount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status?.available) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status?.available]);

  if (segments.length === 0) return null;

  const available = status?.available ?? false;

  async function onSpin() {
    if (spinning || !available) return;
    setError(null);
    setResult(null);
    setSpinning(true);
    try {
      const res = await spin.mutateAsync();
      if (res.status !== 'spun' || res.index == null) {
        setSpinning(false);
        setError('Já girou hoje — volte amanhã.');
        return;
      }
      const idx = res.index;
      const amount = res.amount ?? 0;
      // Land segment `idx` under the top pointer: rotate so its centre reaches 0°.
      const center = idx * SEG_DEG + SEG_DEG / 2;
      const base = Math.floor(rotationRef.current / 360) * 360;
      const target = base + 6 * 360 + (360 - center);
      const from = rotationRef.current;
      rotationRef.current = target;

      const el = wheelRef.current;
      el?.animate(
        [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${target}deg)` }],
        { duration: SPIN_MS, easing: 'cubic-bezier(0.16, 0.84, 0.28, 1)', fill: 'forwards' },
      );

      // Reveal on a timer so it's robust even if the animation engine is throttled.
      window.setTimeout(() => {
        if (el) el.style.transform = `rotate(${target}deg)`;
        setSpinning(false);
        setResult({ amount });
      }, SPIN_MS);
    } catch {
      setSpinning(false);
      setError('Não foi possível girar agora. Tente outra vez.');
    }
  }

  return (
    <section className="card flex flex-col items-center gap-4 p-5 sm:p-6">
      <div className="flex w-full flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-medium text-text sm:text-xl">Roleta diária</h2>
        {!available && status && (
          <span className="font-mono text-xs tabular-nums text-muted-2">
            Renova em {resetIn(status.resets_at, now)}
          </span>
        )}
      </div>
      <p className="-mt-2 w-full font-sans text-sm text-muted-2">
        Um giro grátis por dia. A sorte decide a recompensa.
      </p>

      <div className="relative h-60 w-60">
        {/* Pointer */}
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1">
          <div className="h-0 w-0 border-x-8 border-t-[14px] border-x-transparent border-t-gold drop-shadow" />
        </div>
        <svg
          ref={wheelRef}
          viewBox="0 0 200 200"
          className="h-60 w-60"
          style={{ transform: `rotate(${rotationRef.current}deg)` }}
        >
          {segments.map((seg, i) => {
            const mid = i * SEG_DEG + SEG_DEG / 2;
            const [tx, ty] = polar(100, 100, 62, mid);
            const fill = COLORS[i % 2]!;
            const text = i % 2 === 0 ? '#E9DCC0' : '#0a0907';
            return (
              <g key={seg.idx}>
                <path d={segmentPath(100, 100, 96, i)} fill={fill} stroke="#0a0907" strokeWidth={1} />
                <text
                  x={tx}
                  y={ty}
                  fill={text}
                  fontSize={13}
                  fontWeight={600}
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${mid} ${tx} ${ty})`}
                  className="font-mono"
                >
                  {formatAmount(seg.amount)}
                </text>
              </g>
            );
          })}
          <circle cx={100} cy={100} r={96} fill="none" stroke="#C9A24B" strokeWidth={2} />
          <circle cx={100} cy={100} r={14} fill="#0a0907" stroke="#C9A24B" strokeWidth={2} />
        </svg>
      </div>

      <Button
        variant="primary"
        onClick={onSpin}
        disabled={!available || spinning}
        className="min-w-40"
      >
        {spinning ? (
          'A girar…'
        ) : available ? (
          <>
            <CoinIcon className="h-4 w-4" /> Girar grátis
          </>
        ) : (
          'Já girou hoje'
        )}
      </Button>

      {result && (
        <p className="animate-fade-in font-sans text-sm font-medium text-positive">
          Ganhou +{formatTostoes(result.amount)} na roleta!
        </p>
      )}
      {error && <p className="font-sans text-sm text-muted-2">{error}</p>}
    </section>
  );
}
