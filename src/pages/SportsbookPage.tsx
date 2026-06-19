import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFixtures, useSportsbookRealtime } from '@/features/sportsbook/useSportsbook';
import { FixtureCard } from '@/features/sportsbook/FixtureCard';
import { FeaturedMatch } from '@/features/sportsbook/FeaturedMatch';
import { LiveFixtures } from '@/features/sportsbook/LiveFixtures';
import { BetSlip } from '@/features/sportsbook/BetSlip';
import { MyBets } from '@/features/sportsbook/MyBets';
import type { Fixture } from '@/types/db';

type Tab = 'fixtures' | 'bets';

export function SportsbookPage() {
  const { data: fixtures, isLoading } = useFixtures();
  const [tab, setTab] = useState<Tab>('fixtures');
  useSportsbookRealtime();

  const byLeague = useMemo(() => {
    const map = new Map<string, Fixture[]>();
    for (const f of fixtures ?? []) {
      const list = map.get(f.league) ?? [];
      list.push(f);
      map.set(f.league, list);
    }
    return [...map.entries()];
  }, [fixtures]);

  return (
    <div className="animate-fade-in space-y-6">
      <Link to="/" className="font-sans text-sm text-muted-2 hover:text-text">
        ← Voltar às Mesas
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[32px] font-medium text-text">Futebol</h1>
        <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">
          <span className="h-1.5 w-1.5 animate-livedot rounded-full bg-negative" /> Ao vivo e brevemente
        </span>
      </div>
      <p className="font-sans text-sm text-muted">
        1 · X · 2 — toque numa cotação para criar o seu boletim
      </p>
      <div className="h-px bg-gradient-to-r from-border to-transparent" />

      <div className="flex gap-2">
        {(['fixtures', 'bets'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`focus-ring rounded-full px-4 py-1.5 font-sans text-xs font-medium uppercase tracking-[0.14em] transition-colors ${
              tab === t ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'
            }`}
          >
            {t === 'fixtures' ? 'Jogos' : 'As minhas apostas'}
          </button>
        ))}
      </div>

      {tab === 'bets' ? (
        <MyBets />
      ) : (
        <div className="flex flex-wrap gap-[30px]">
          <div className="min-w-[300px] flex-[3_1_600px] space-y-6">
            <FeaturedMatch />
            <LiveFixtures />
            {isLoading ? (
              <p className="py-8 text-center text-muted-2">A carregar jogos…</p>
            ) : byLeague.length === 0 ? (
              <div className="card p-8 text-center text-sm text-muted-2">
                Ainda sem jogos. A sincronização diária vai preenchê-los.
              </div>
            ) : (
              byLeague.map(([league, list]) => (
                <div key={league} className="space-y-3">
                  <p className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-gold">
                    {league}
                  </p>
                  {list.map((f) => (
                    <FixtureCard key={f.id} fixture={f} />
                  ))}
                </div>
              ))
            )}
          </div>
          <aside className="min-w-[296px] flex-[1_1_300px]">
            <BetSlip />
          </aside>
        </div>
      )}
    </div>
  );
}
