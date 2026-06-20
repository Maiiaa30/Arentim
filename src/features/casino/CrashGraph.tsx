import { crashMult, crashFlySeconds } from './liveRoom';

const W = 100;
const H = 60;

/** "Nice" multiplier values we draw a labelled gridline for, when in range. */
const GRID_VALUES = [1, 1.5, 2, 3, 5, 10, 20, 50, 100, 200, 500];

function lineColor(mult: number, exploded: boolean): string {
  if (exploded) return '#e0555f';
  if (mult < 2) return '#ff7a3d';
  if (mult < 5) return '#ff8c2b';
  if (mult < 10) return '#ff6a2a';
  return '#e0555f';
}

/** y-pixel for a multiplier on the current log scale (top = yMax). */
function yFor(m: number, yMax: number): number {
  return H - (Math.log(Math.max(m, 1)) / Math.log(yMax)) * H;
}

/** Time-based curve: x = elapsed fraction, y = log(mult at t). Grows rightward. */
function curvePath(elapsed: number, xMax: number, yMax: number): string {
  const N = 56;
  let d = '';
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * elapsed;
    const x = (t / xMax) * W;
    const y = yFor(crashMult(t), yMax);
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d.trim();
}

function CloudShape({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 64 28" className={className} style={style} aria-hidden fill="currentColor">
      <path d="M16 24c-7 0-12-4-12-9s5-8 10-8c1-5 6-7 10-7 5 0 9 3 10 7 6 0 12 3 12 9s-6 8-12 8H16Z" />
    </svg>
  );
}

/**
 * Crash chart matching the reference: a smooth time-based curve that grows from
 * the origin, a soft purple core glow, drifting clouds and a vignette behind it,
 * a glowing leading edge, and crisp axis labels. Axis text lives in normal-aspect
 * HTML (NOT inside the preserveAspectRatio="none" SVG, which would stretch it).
 */
export function CrashGraph({
  mult,
  exploded,
  flying,
}: {
  mult: number;
  exploded: boolean;
  flying: boolean;
}) {
  // Derive elapsed from the multiplier so the curve and rocket stay in lock-step
  // with the readout (mult = e^(k·t)).
  const elapsed = mult <= 1 ? 0 : Math.min(crashFlySeconds(mult), 600);
  const xMax = Math.max(12, elapsed * 1.15);
  const yMax = Math.max(mult * 1.08, 2);
  const color = lineColor(mult, exploded);

  const yTicks = GRID_VALUES.filter((v) => v <= yMax);
  const headLeft = (elapsed / xMax) * 100;
  const headTop = (yFor(mult, yMax) / H) * 100;

  // X-axis seconds ticks (every 2s up to xMax).
  const step = xMax <= 16 ? 2 : xMax <= 40 ? 5 : 10;
  const xTicks: number[] = [];
  for (let s = 0; s <= xMax + 0.01; s += step) xTicks.push(Math.round(s));

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Core glow + vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 60%, rgba(124,77,160,0.22), rgba(0,0,0,0) 55%), radial-gradient(140% 120% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.5))',
        }}
      />

      {/* Drifting clouds */}
      <div className="pointer-events-none absolute inset-0 text-white/[0.05]">
        <CloudShape className="animate-drift absolute h-7 w-16" style={{ left: '14%', top: '22%' }} />
        <CloudShape className="animate-floaty absolute h-5 w-12" style={{ left: '58%', top: '14%', animationDuration: '5s' }} />
        <CloudShape className="animate-drift absolute h-6 w-14" style={{ left: '72%', top: '40%', animationDuration: '15s' }} />
        <CloudShape className="animate-floaty absolute h-4 w-10" style={{ left: '34%', top: '52%', animationDuration: '6s' }} />
      </div>

      {/* Y-axis multiplier labels (normal aspect, no stretch) */}
      <div className="pointer-events-none absolute inset-0">
        {yTicks.map((v) => (
          <span
            key={v}
            className="absolute left-1 font-mono text-[10px] tabular-nums text-white/30"
            style={{ top: `calc(${(yFor(v, yMax) / H) * 100}% - 6px)` }}
          >
            {v}×
          </span>
        ))}
        {xTicks.map((s) => (
          <span
            key={s}
            className="absolute bottom-0.5 font-mono text-[9px] tabular-nums text-white/25"
            style={{ left: `${(s / xMax) * 100}%`, transform: 'translateX(2px)' }}
          >
            {s}s
          </span>
        ))}
      </div>

      {/* Curve (paths only — safe under non-uniform scaling) */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="crashArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id="crashGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal gridlines */}
        {yTicks.map((v) => {
          const y = yFor(v, yMax);
          return <line key={v} x1="0" y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.25" />;
        })}
        <line x1="0" y1={H} x2={W} y2={H} stroke="rgba(255,255,255,0.18)" strokeWidth="0.4" />

        {elapsed > 0 && (
          <>
            <path d={`${curvePath(elapsed, xMax, yMax)} L ${(elapsed / xMax) * W} ${H} L 0 ${H} Z`} fill="url(#crashArea)" />
            <path
              d={curvePath(elapsed, xMax, yMax)}
              fill="none"
              stroke={color}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#crashGlow)"
            />
          </>
        )}
      </svg>

      {/* Leading edge + rocket (HTML overlay → crisp, smooth) */}
      {elapsed > 0 && (
        <div
          className="absolute"
          style={{ left: `${headLeft}%`, top: `${headTop}%`, transform: 'translate(-50%,-50%)' }}
        >
          {!exploded && (
            <span
              className="absolute left-1/2 top-1/2 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: color, boxShadow: `0 0 10px 3px ${color}` }}
            />
          )}
          <span
            className={`relative block text-2xl ${flying ? 'animate-floaty' : ''}`}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            aria-hidden
          >
            {exploded ? '💥' : '🚀'}
          </span>
        </div>
      )}
    </div>
  );
}
