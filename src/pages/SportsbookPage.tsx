import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow } from '@/components/ui/primitives';
import { useFixtures, useSportsbookRealtime } from '@/features/sportsbook/useSportsbook';
import { FixtureCard } from '@/features/sportsbook/FixtureCard';
import { FeaturedMatch } from '@/features/sportsbook/FeaturedMatch';
import { LiveFixtures } from '@/features/sportsbook/LiveFixtures';
import { BetSlip } from '@/features/sportsbook/BetSlip';
import { MyBets } from '@/features/sportsbook/MyBets';
import type { Fixture } from '@/types/db';

type Tab = 'fixtures' | 'bets';

/** Local YYYY-MM-DD key for grouping by calendar day. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return 'Hoje';
  if (same(date, tomorrow)) return 'Amanhã';
  return date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Sub-group a day's fixtures by competition. */
function groupByLeague(list: Fixture[]): [string, Fixture[]][] {
  const map = new Map<string, Fixture[]>();
  for (const f of list) {
    const b = map.get(f.league);
    if (b) b.push(f);
    else map.set(f.league, [f]);
  }
  return [...map.entries()];
}

export function SportsbookPage() {
  const { data: fixtures, isLoading } = useFixtures();
  const [tab, setTab] = useState<Tab>('fixtures');
  const [day, setDay] = useState<string | null>(null);
  useSportsbookRealtime();

  // Fixtures grouped by day, earliest first (useFixtures already returns them sorted).
  const dayGroups = useMemo(() => {
    const map = new Map<string, Fixture[]>();
    for (const f of fixtures ?? []) {
      const k = dayKey(f.kickoff);
      const b = map.get(k);
      if (b) b.push(f);
      else map.set(k, [f]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [fixtures]);

  const shownDays = day ? dayGroups.filter(([k]) => k === day) : dayGroups;

  return (
    <div className="animate-fade-in space-y-6">
      <Link to="/" className="font-sans text-sm text-muted-2 hover:text-text">
        ← Voltar às Mesas
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Aretim · Casa de Apostas</Eyebrow>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[32px] font-medium leading-none text-text">Futebol</h1>
            <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">
              <span className="h-1.5 w-1.5 animate-livedot rounded-full bg-negative" /> Ao vivo e brevemente
            </span>
          </div>
          <p className="mt-2 font-sans text-sm text-muted">
            1 · X · 2 — toque numa cotação para criar o seu boletim
          </p>
        </div>
        <Link
          to="/resultados"
          className="focus-ring group inline-flex min-h-[40px] items-center gap-2 rounded-full border border-gold/40 bg-gold/[0.06] px-4 py-2 font-sans text-xs font-medium uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold/[0.12]"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-negative opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-negative" />
          </span>
          Resultados ao vivo
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
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
        <div className="flex flex-wrap gap-6 sm:gap-[30px]">
          <div className="min-w-0 flex-[3_1_600px] space-y-6">
            <FeaturedMatch />
            <LiveFixtures />
            {isLoading ? (
              <p className="py-8 text-center text-muted-2">A carregar jogos…</p>
            ) : dayGroups.length === 0 ? (
              <div className="card p-8 text-center text-sm text-muted-2">
                Ainda sem jogos. A sincronização diária vai preenchê-los.
              </div>
            ) : (
              <>
                {/* Day selector */}
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  <button
                    onClick={() => setDay(null)}
                    className={`focus-ring shrink-0 rounded-full px-3.5 py-1.5 font-sans text-xs font-medium uppercase tracking-[0.14em] transition-colors ${
                      day === null ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'
                    }`}
                  >
                    Todos
                  </button>
                  {dayGroups.map(([k, list]) => (
                    <button
                      key={k}
                      onClick={() => setDay(k)}
                      className={`focus-ring flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 font-sans text-xs font-medium uppercase tracking-[0.14em] transition-colors ${
                        day === k ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'
                      }`}
                    >
                      <span className="capitalize">{dayLabel(k)}</span>
                      <span className="opacity-60">{list.length}</span>
                    </button>
                  ))}
                </div>

                {/* Day sections with sticky headers + separation */}
                <div className="space-y-8">
                  {shownDays.map(([k, list]) => (
                    <section key={k} className="space-y-3">
                      <div className="sticky top-[68px] z-10 -mx-1 flex items-center justify-between border-b border-border bg-bg/90 px-1 py-2 backdrop-blur">
                        <h2 className="font-display text-lg font-medium capitalize text-text">{dayLabel(k)}</h2>
                        <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">
                          {list.length} {list.length === 1 ? 'jogo' : 'jogos'}
                        </span>
                      </div>
                      {groupByLeague(list).map(([league, fx]) => (
                        <div key={league} className="space-y-2">
                          <p className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-gold">
                            {league}
                          </p>
                          {fx.map((f) => (
                            <FixtureCard key={f.id} fixture={f} />
                          ))}
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside className="min-w-0 flex-[1_1_300px]">
            <BetSlip />
          </aside>
        </div>
      )}
    </div>
  );
}
