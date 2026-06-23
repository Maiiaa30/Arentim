import { tierName } from './level';

/** Compact level chip (e.g. "Nv 12 · Habitué"). */
export function LevelBadge({ level, className = '' }: { level: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-gold ${className}`}
      title={`Nível ${level} · ${tierName(level)}`}
    >
      Nv {level}
      <span className="font-sans font-medium text-gold/80">· {tierName(level)}</span>
    </span>
  );
}
