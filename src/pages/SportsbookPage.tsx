import { useState } from 'react';
import { useFixtures, useSportsbookRealtime } from '@/features/sportsbook/useSportsbook';
import { FixtureCard } from '@/features/sportsbook/FixtureCard';
import { FeaturedMatch } from '@/features/sportsbook/FeaturedMatch';
import { LiveFixtures } from '@/features/sportsbook/LiveFixtures';
import { BetSlip } from '@/features/sportsbook/BetSlip';
import { MyBets } from '@/features/sportsbook/MyBets';

type Tab = 'fixtures' | 'bets';

export function SportsbookPage() {
  const { data: fixtures, isLoading } = useFixtures();
  const [tab, setTab] = useState<Tab>('fixtures');
  useSportsbookRealtime();

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Sportsbook</h1>
        <p className="mt-1 text-sm text-muted">Primeira Liga & more. Singles and parlays.</p>
      </div>

      <div className="flex gap-2">
        {(['fixtures', 'bets'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`focus-ring rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'
            }`}
          >
            {t === 'fixtures' ? 'Fixtures' : 'My bets'}
          </button>
        ))}
      </div>

      {tab === 'bets' ? (
        <MyBets />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <FeaturedMatch />
            <LiveFixtures />
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-text">Upcoming</h2>
              {isLoading ? (
                <p className="py-8 text-center text-muted">Loading fixtures…</p>
              ) : !fixtures || fixtures.length === 0 ? (
                <div className="card p-8 text-center text-sm text-muted">
                  No upcoming fixtures yet. The daily sync will populate them.
                </div>
              ) : (
                fixtures.map((f) => <FixtureCard key={f.id} fixture={f} />)
              )}
            </div>
          </div>
          <div className="hidden lg:block">
            <BetSlip />
          </div>
        </div>
      )}

      {/* Bet slip on mobile (below fixtures) */}
      {tab === 'fixtures' && (
        <div className="lg:hidden">
          <BetSlip />
        </div>
      )}
    </div>
  );
}
