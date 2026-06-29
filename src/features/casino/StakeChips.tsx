import { CoinIcon } from '@/components/CoinIcon';
import { formatTos } from '@/lib/format';

const CHIPS = [5, 10, 25, 50, 100];

interface StakeChipsProps {
  stake: number;
  onChange: (stake: number) => void;
  balance: number;
  disabled?: boolean;
  /** Show a free-type amount input with ½ / 2× / Máx helpers (on by default). */
  custom?: boolean;
  /** Lowest allowed stake (default 1). Chips below this still show but the input clamps up. */
  min?: number;
  /** Optional hard cap on top of the balance (e.g. a per-machine max bet). */
  max?: number;
}

/** Chip selector for single-stake games, with an optional free-type amount. */
export function StakeChips({ stake, onChange, balance, disabled, custom = true, min = 1, max }: StakeChipsProps) {
  const hardMax = Math.max(min, Math.min(balance, max ?? balance));
  const clamp = (v: number) => Math.min(hardMax, Math.max(min, Math.floor(Number(v) || 0)));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled || c > hardMax}
            onClick={() => onChange(c)}
            className={`focus-ring rounded px-3 py-1 font-mono text-sm font-semibold transition-colors disabled:opacity-40 ${
              stake === c ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'
            }`}
          >
            {c}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1 font-mono text-xs text-muted-2">
          <CoinIcon className="h-3.5 w-3.5" /> {formatTos(balance)}
        </span>
      </div>

      {custom && (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={hardMax}
            value={stake}
            disabled={disabled}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            onBlur={(e) => onChange(clamp(Number(e.target.value)))}
            className="focus-ring w-24 rounded border border-border bg-surface px-2.5 py-1 font-mono text-sm text-text disabled:opacity-40"
            aria-label="Aposta personalizada"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(clamp(Math.floor(stake / 2)))}
            className="focus-ring rounded border border-border px-2 py-1 font-mono text-xs text-muted hover:text-text disabled:opacity-40"
          >
            ½
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(clamp(stake * 2))}
            className="focus-ring rounded border border-border px-2 py-1 font-mono text-xs text-muted hover:text-text disabled:opacity-40"
          >
            2×
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(hardMax)}
            className="focus-ring rounded border border-border px-2 py-1 font-mono text-xs text-muted hover:text-text disabled:opacity-40"
          >
            Máx
          </button>
        </div>
      )}
    </div>
  );
}
