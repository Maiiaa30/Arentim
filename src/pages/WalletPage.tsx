import { useMemo, useState } from 'react';
import { useTransactions } from '@/features/wallet/useTransactions';
import type { TransactionType } from '@/types/db';
import { formatAmount } from '@/lib/format';
import { BalanceChart } from '@/components/BalanceChart';
import { CoinIcon } from '@/components/CoinIcon';
import { Eyebrow, SectionHeader } from '@/components/ui/primitives';

const FILTERS: { value: TransactionType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'bet', label: 'Apostas' },
  { value: 'win', label: 'Ganhos' },
  { value: 'bonus', label: 'Bónus' },
  { value: 'adjustment', label: 'Ajustes' },
];

const TX_LABEL: Record<TransactionType, string> = {
  bonus: 'Bónus',
  bet: 'Aposta',
  win: 'Ganho',
  loss: 'Perda',
  refund: 'Reembolso',
  adjustment: 'Ajuste',
};

const typeStyles: Record<TransactionType, string> = {
  bonus: 'text-gold',
  win: 'text-positive',
  bet: 'text-muted-2',
  loss: 'text-negative',
  refund: 'text-gold',
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
    <div className="animate-fade-in space-y-8">
      <div>
        <Eyebrow>Carteira</Eyebrow>
        <h1 className="mt-2 font-display text-[26px] font-medium leading-tight text-text sm:text-[34px]">Carteira</h1>
        <p className="mt-1 font-sans text-sm text-muted-2">
          O seu histórico de saldo e o registo completo de transações.
        </p>
      </div>

      <section className="space-y-4">
        <SectionHeader title="Saldo ao longo do tempo" />
        <div className="card p-6">
          <BalanceChart points={chartPoints} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Histórico de transações" />
        <div className="card overflow-hidden">
          <div className="flex flex-wrap gap-2 border-b border-border p-4">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`focus-ring inline-flex min-h-[40px] items-center rounded px-3 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
                  filter === f.value ? 'bg-gold text-bg' : 'text-muted-2 hover:text-text'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="p-8 text-center text-muted-2">A carregar…</p>
          ) : !transactions || transactions.length === 0 ? (
            <p className="p-8 text-center text-muted-2">Ainda sem transações.</p>
          ) : (
            <ul className="divide-y divide-border">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-sans text-sm font-medium text-text">
                      <span className={typeStyles[t.type]}>{TX_LABEL[t.type]}</span>
                      {t.game && <span className="text-muted-2"> · {t.game}</span>}
                    </p>
                    <p className="font-sans text-xs text-muted-2">
                      {formatDateTime(t.created_at)}
                      {t.note && ` · ${t.note}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`flex items-center justify-end gap-1 font-mono text-sm font-semibold tabular-nums ${
                        t.amount >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {t.amount >= 0 ? '+' : '−'}
                      {formatAmount(Math.abs(t.amount))}
                      <CoinIcon className="h-3.5 w-3.5" />
                    </p>
                    <p className="font-mono text-xs text-muted-2 tabular-nums">
                      saldo {formatAmount(t.balance_after)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
