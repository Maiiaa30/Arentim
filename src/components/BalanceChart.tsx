import { useMemo } from 'react';

interface BalanceChartProps {
  /** Balance-after points in chronological order (oldest first). */
  points: number[];
  className?: string;
}

/**
 * Minimal dependency-free sparkline of balance over time. Renders nothing
 * meaningful for fewer than two points.
 */
export function BalanceChart({ points, className }: BalanceChartProps) {
  const path = useMemo(() => {
    if (points.length < 2) return null;
    const w = 600;
    const h = 160;
    const pad = 8;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const stepX = (w - pad * 2) / (points.length - 1);

    const coords = points.map((p, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((p - min) / range) * (h - pad * 2);
      return [x, y] as const;
    });

    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const lastX = coords[coords.length - 1]![0];
    const firstX = coords[0]![0];
    const area = `${line} L${lastX.toFixed(1)},${h - pad} L${firstX.toFixed(1)},${h - pad} Z`;
    return { line, area, w, h };
  }, [points]);

  if (!path) {
    return (
      <div className={`flex h-40 items-center justify-center text-sm text-muted ${className ?? ''}`}>
        Atividade insuficiente para o gráfico.
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${path.w} ${path.h}`}
      className={`h-40 w-full ${className ?? ''}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Saldo ao longo do tempo"
    >
      <defs>
        <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4A24A" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#D4A24A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#balanceFill)" />
      <path d={path.line} fill="none" stroke="#D4A24A" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
