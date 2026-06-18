import { useMemo, useState } from 'react';
import { useTransactions } from '@/features/wallet/useTransactions';
import type { TransactionType } from '@/types/db';
import { formatAmount } from '@/lib/format';
import { BalanceChart } from '@/components/BalanceChart';
import { CoinIcon } from '@/components/CoinIcon';

const FILTERS: { value: TransactionType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bet', label: 'Bets' },
  { value: 'win', label: 'Wins' },
  { value: 'bonus', label: 'Bonuses' },
  { value: 'adjustment', label: 'Adjustments' },
];

const typeStyles: Record<TransactionType, string> = {
  bonus: 'text-accent',
  win: 'text-positive',
  bet: 'text-muted',
  loss: 'text-negative',
  refund: 'text-accent',
  adjustment: 'text-gold',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-PT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function WalletPage() {
  const [filter, setFilter] = useState<TransactionType | 'all'>('all');
  const { data: transactions, isLoading } = useTransactions({ type: filter });

  // Chart always reflects overall balance history, independent of the filter.
  const { data: allTx } = useTransactions({ type: 'all', limit: 200 });
  const chartPoints = useMemo(
    () => (allTx ? [...allTx].reverse().map((t) => t.balance_after) : []),
    [allTx],
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Wallet</h1>
        <p className="mt-1 text-sm text-muted">Your balance history and full transaction ledger.</p>
      </div>

      <section className="card p-6">
        <h2 className="text-sm font-medium text-muted">Balance over time</h2>
        <div className="mt-4">
          <BalanceChart points={chartPoints} />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`focus-ring rounded-full px-3 py-1 text-sm transition-colors ${
                filter === f.value ? 'bg-gold text-bg' : 'text-muted hover:text-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="p-8 text-center text-muted">Loading…</p>
        ) : !transactions || transactions.length === 0 ? (
          <p className="p-8 text-center text-muted">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">
                    <span className={`capitalize ${typeStyles[t.type]}`}>{t.type}</span>
                    {t.game && <span className="text-muted"> · {t.game}</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(t.created_at)}
                    {t.note && ` · ${t.note}`}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`flex items-center justify-end gap-1 text-sm font-semibold tabular-nums ${
                      t.amount >= 0 ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {t.amount >= 0 ? '+' : '−'}
                    {formatAmount(Math.abs(t.amount))}
                    <CoinIcon className="h-3.5 w-3.5" />
                  </p>
                  <p className="text-xs text-muted tabular-nums">bal {formatAmount(t.balance_after)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
