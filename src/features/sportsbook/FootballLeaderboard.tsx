import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { RingAvatar, SectionHeader } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import type { FootballLeaderRow } from '@/types/db';

type Board = 'wagered' | 'won' | 'lost';

const TABS: { key: Board; label: string; tone: string }[] = [
  { key: 'wagered', label: 'Mais apostou', tone: 'text-gold' },
  { key: 'won', label: 'Mais ganhou', tone: 'text-positive' },
  { key: 'lost', label: 'Mais perdeu', tone: 'text-negative' },
];

function useFootballLeaderboard() {
  return useQuery({
    queryKey: ['football-leaderboard'] as const,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<FootballLeaderRow[]> => {
      const { data, error } = await supabase.rpc('football_leaderboard');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function FootballLeaderboard() {
  const { data, isLoading } = useFootballLeaderboard();
  const [tab, setTab] = useState<Board>('wagered');

  const rows = useMemo(() => {
    const list = [...(data ?? [])];
    list.sort((a, b) => Number(b[tab]) - Number(a[tab]));
    return list.filter((r) => Number(r[tab]) > 0).slice(0, 5);
  }, [data, tab]);

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <div className="card space-y-3 p-4 sm:p-5">
      <SectionHeader title="Tabela de Apostadores" right="Futebol" />
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`focus-ring flex-1 rounded-full border px-3 py-1.5 font-sans text-[11px] font-medium uppercase tracking-[0.1em] transition-colors ${
              tab === t.key ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {isLoading && <p className="px-2 py-3 text-sm text-muted-2">A carregar…</p>}
        {!isLoading && rows.length === 0 && <p className="px-2 py-3 text-sm text-muted-2">Ainda sem dados.</p>}
        {rows.map((r, i) => {
          const tone = TABS.find((t) => t.key === tab)!.tone;
          return (
            <div key={r.id} className="flex items-center gap-3 rounded px-2 py-1.5">
              <span className={`w-5 text-right font-display ${i < 3 ? 'text-gold' : 'text-muted-2'}`}>{i + 1}</span>
              <RingAvatar initials={r.name.slice(0, 2).toUpperCase()} size={32} tone={i < 3 ? 'gold' : 'muted'} />
              <span className="flex-1 truncate font-sans text-sm text-body">{r.name}</span>
              <span className="text-right">
                <span className={`block font-mono text-sm font-semibold ${tone}`}>{formatAmount(Number(r[tab]))}</span>
                <span className="block font-sans text-[10px] text-muted-2">{r.bets} aposta{r.bets === 1 ? '' : 's'}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
