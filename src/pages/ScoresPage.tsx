import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow, SectionHeader } from '@/components/ui/primitives';
import { useAllFixtures, useSportsbookRealtime } from '@/features/sportsbook/useSportsbook';
import { ScoreRow } from '@/features/sportsbook/ScoreRow';
import type { Fixture } from '@/types/db';

/**
 * Resultados — a FlashScore-style scores experience. Lists every fixture we hold
 * grouped into AO VIVO / PRÓXIMOS / TERMINADOS, then by competition + date.
 * Read-only: it reuses the sportsbook fixtures hook and the Realtime channel and
 * never touches money/bet logic. Auto-refreshes via React Query + Realtime.
 *
 * Data comes from Football-Data.org (free) via the sync-fixtures /
 * poll-live-scores Edge Functions. This page renders gracefully from whatever is
 * present; once FOOTBALL_DATA_TOKEN is set and the daily sync runs it fills with
 * real fixtures + the last 3 days of results.
 */

type Filter = 'todos' | 'live' | 'upcoming' | 'finished';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'live', label: 'Ao vivo' },
  { key: 'upcoming', label: 'Próximos' },
  { key: 'finished', label: 'Últimos 3 dias' },
];

const THREE_DAYS_MS = 3 * 86_400_000;

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'Hoje';
  if (same(d, tomorrow)) return 'Amanhã';
  return d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
};

/** Group a list of fixtures by "Competição · Dia", preserving input order. */
function groupByLeagueDay(list: Fixture[]): [string, Fixture[]][] {
  const map = new Map<string, Fixture[]>();
  for (const f of list) {
    const key = `${f.league} · ${dayLabel(f.kickoff)}`;
    const bucket = map.get(key) ?? [];
    bucket.push(f);
    map.set(key, bucket);
  }
  return [...map.entries()];
}

function Section({
  title,
  count,
  live,
  groups,
}: {
  title: string;
  count: number;
  live?: boolean;
  groups: [string, Fixture[]][];
}) {
  if (count === 0) return null;
  return (
    <section className="space-y-4">
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            {live && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-negative opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-negative" />
              </span>
            )}
            {title}
          </span>
        }
        right={`${count} ${count === 1 ? 'jogo' : 'jogos'}`}
      />
      <div className="space-y-5">
        {groups.map(([key, fixtures]) => (
          <div key={key} className="space-y-2">
            <p className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-gold">{key}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {fixtures.map((f) => (
                <ScoreRow key={f.id} fixture={f} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ScoresPage() {
  const { data: fixtures, isLoading } = useAllFixtures();
  const [filter, setFilter] = useState<Filter>('todos');
  useSportsbookRealtime();

  const { liveList, upcomingList, finishedList } = useMemo(() => {
    const all = fixtures ?? [];
    const liveList = all
      .filter((f) => f.status === 'live')
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
    const upcomingList = all
      .filter((f) => f.status === 'scheduled' || f.status === 'postponed')
      .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
    const cutoff = Date.now() - THREE_DAYS_MS;
    const finishedList = all
      .filter((f) => f.status === 'finished' && +new Date(f.kickoff) >= cutoff)
      .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff));
    return { liveList, upcomingList, finishedList };
  }, [fixtures]);

  const showLive = filter === 'todos' || filter === 'live';
  const showUpcoming = filter === 'todos' || filter === 'upcoming';
  const showFinished = filter === 'todos' || filter === 'finished';

  const total = liveList.length + upcomingList.length + finishedList.length;

  return (
    <div className="animate-fade-in space-y-6">
      <Link to="/sportsbook" className="font-sans text-sm text-muted-2 hover:text-text">
        ← Voltar ao Futebol
      </Link>

      <div>
        <Eyebrow>Aretim · Futebol</Eyebrow>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[32px] font-medium leading-none text-text">Resultados</h1>
          <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">
            <span className="h-1.5 w-1.5 animate-livedot rounded-full bg-negative" /> Atualização automática
          </span>
        </div>
        <p className="mt-2 max-w-prose font-sans text-sm text-muted">
          Resultados ao vivo, próximos jogos e jogos terminados. A página atualiza-se sozinha.
        </p>
      </div>

      <div className="-mx-1 flex flex-wrap gap-2 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`focus-ring min-h-[40px] rounded-full px-4 py-2 font-sans text-xs font-medium uppercase tracking-[0.14em] transition-colors ${
              filter === f.key ? 'bg-gold text-bg' : 'border border-border text-muted-2 hover:text-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="h-px bg-gradient-to-r from-border to-transparent" />

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-2">A carregar resultados…</p>
      ) : total === 0 ? (
        <div className="card p-8 text-center text-sm text-muted-2">
          Ainda sem jogos. A sincronização diária vai preenchê-los assim que houver dados disponíveis.
        </div>
      ) : (
        <div className="space-y-8">
          {showLive && (
            <Section title="Ao vivo" count={liveList.length} live groups={groupByLeagueDay(liveList)} />
          )}
          {showUpcoming && (
            <Section
              title="Próximos"
              count={upcomingList.length}
              groups={groupByLeagueDay(upcomingList)}
            />
          )}
          {showFinished && (
            <Section
              title="Últimos 3 dias"
              count={finishedList.length}
              groups={groupByLeagueDay(finishedList)}
            />
          )}

          {/* Active filter yielded nothing, but other categories have games. */}
          {((showLive && !showUpcoming && !showFinished && liveList.length === 0) ||
            (showUpcoming && !showLive && !showFinished && upcomingList.length === 0) ||
            (showFinished && !showLive && !showUpcoming && finishedList.length === 0)) && (
            <div className="card p-8 text-center text-sm text-muted-2">Sem jogos nesta categoria.</div>
          )}
        </div>
      )}
    </div>
  );
}
