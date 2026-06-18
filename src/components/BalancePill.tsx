import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';

interface BalancePillProps {
  /** Whole-integer Tostões. */
  amount: number;
}

/** Compact balance display used in the header. */
export function BalancePill({ amount }: BalancePillProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5">
      <CoinIcon className="h-4 w-4" />
      <span className="tabular-nums text-sm font-semibold text-text">{formatAmount(amount)}</span>
      <span className="text-xs text-muted">Tostões</span>
    </div>
  );
}
