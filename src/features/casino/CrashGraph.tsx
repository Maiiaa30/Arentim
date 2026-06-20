const W = 100;
const H = 60;

/** "Nice" multiplier values we draw a labelled gridline for, when in range. */
const GRID_VALUES = [1.5, 2, 3, 5, 10, 20, 50, 100, 200, 500];

function lineColor(mult: number, exploded: boolean): string {
  if (exploded) return '#e0555f';
  if (mult < 2) return '#C9A24B';
  if (mult < 5) return '#e0a83a';
  if (mult < 10) return '#e07f2a';
  return '#e0555f';
}

/** y-pixel for a multiplier on the current log scale (top = yMax). */
function yFor(m: number, yMax: number): number {
  return H - (Math.log(Math.max(m, 1)) / Math.log(yMax)) * H;
}

/** Exponential curve from the origin up to `mult`, filling the box width. */
function curvePath(mult: number, yMax: number): string {
  const N = 48;
  let d = '';
  for (let i = 0; i <= N; i++) {
    const frac = i / N;
    const m = Math.pow(mult, frac);
    const x = frac * W;
    const y = yFor(m, yMax);
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d.trim();
}

/**
 * A richer crash chart: fixed log Y-grid with multiplier labels that "zoom out"
 * as the rocket climbs, a gradient area fill, a glowing leading edge, and the
 * rocket / explosion marker. Pure SVG — the multiplier readout is overlaid by
 * the page on top of this.
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
  const yMax = Math.max(mult * 1.08, 2);
  const color = lineColor(mult, exploded);
  const headX = W;
  const headY = yFor(mult, yMax);
  const grids = GRID_VALUES.filter((v) => v <= yMax);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="crashArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="crashGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Baseline */}
      <line x1="0" y1={H} x2={W} y2={H} stroke="rgba(201,162,75,0.22)" strokeWidth="0.4" />

      {/* Log multiplier gridlines (zoom out as mult grows) */}
      {grids.map((v) => {
        const y = yFor(v, yMax);
        return (
          <g key={v}>
            <line x1="0" y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" strokeDasharray="1.5 1.5" />
            <text x="1.5" y={y - 1} fill="rgba(255,255,255,0.30)" fontSize="3" fontFamily="monospace">
              {v}×
            </text>
          </g>
        );
      })}

      {/* Area + curve */}
      <path d={`${curvePath(mult, yMax)} L ${W} ${H} L 0 ${H} Z`} fill="url(#crashArea)" />
      <path
        d={curvePath(mult, yMax)}
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#crashGlow)"
      />

      {/* Leading edge */}
      {!exploded && (
        <circle cx={headX} cy={headY} r="1.6" fill={color} filter="url(#crashGlow)">
          {flying && <animate attributeName="r" values="1.4;2.1;1.4" dur="0.9s" repeatCount="indefinite" />}
        </circle>
      )}
    </svg>
  );
}
