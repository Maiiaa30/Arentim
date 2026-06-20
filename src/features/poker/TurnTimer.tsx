import { useEffect, useState } from 'react';

/** Server turn budget (mirrors TURN_MS in the poker-table edge function). */
const TURN_TOTAL_MS = 30_000;

/**
 * A shrinking countdown bar for the player to act. Purely presentational: the
 * server enforces the deadline (auto-folding a player who blows it), so this
 * only visualises the time left. Turns red in the final seconds.
 */
export function TurnTimer({ deadline }: { deadline: string }) {
  const end = Date.parse(deadline);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (Number.isNaN(end)) return null;
  const remaining = Math.max(0, end - now);
  const pct = Math.max(0, Math.min(100, (remaining / TURN_TOTAL_MS) * 100));
  const secs = Math.ceil(remaining / 1000);
  const low = remaining <= 8000;

  return (
    <div className="space-y-1" aria-live="off">
      <div className="flex items-center justify-between font-sans text-[11px] uppercase tracking-[0.14em] text-muted-2">
        <span>O seu tempo para jogar</span>
        <span className={`font-mono tabular-nums ${low ? 'font-semibold text-negative' : 'text-muted'}`}>{secs}s</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${low ? 'bg-negative' : 'bg-gold'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
