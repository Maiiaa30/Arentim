import type { ReactNode } from 'react';

interface StatTileProps {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'positive' | 'negative' | 'gold';
}

const tones = {
  default: 'text-text',
  positive: 'text-positive',
  negative: 'text-negative',
  gold: 'text-gold',
};

export function StatTile({ label, value, tone = 'default' }: StatTileProps) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
    </div>
  );
}
