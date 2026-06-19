import { CoinIcon } from '@/components/CoinIcon';
import { formatTt } from '@/lib/format';

const CHIPS = [10, 25, 50, 100, 500];

interface StakeChipsProps {
  stake: number;
  onChange: (stake: number) => void;
  balance: number;
  disabled?: boolean;
}

/** Chip selector for single-stake games. Disables chips above the balance. */
export function StakeChips({ stake, onChange, balance, disabled }: StakeChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CHIPS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled || c > balance}
          onClick={() => onChange(c)}
          className={`focus-ring rounded px-3 py-1 font-mono text-sm font-semibold transition-colors disabled:opacity-40 ${
            stake === c ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'
          }`}
        >
          {c}
        </button>
      ))}
      <span className="ml-auto flex items-center gap-1 font-mono text-xs text-muted-2">
        <CoinIcon className="h-3.5 w-3.5" /> {formatTt(balance)}
      </span>
    </div>
  );
}
