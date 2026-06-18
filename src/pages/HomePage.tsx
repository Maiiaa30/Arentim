import { Link } from 'react-router-dom';
import { CoinIcon } from '@/components/CoinIcon';
import { useAuth } from '@/features/auth/AuthProvider';
import { DailyBonusCard } from '@/features/bonus/DailyBonusCard';

const tiles = [
  { to: '/casino', title: 'Casino', body: 'Roulette, Blackjack, Slots & quick games.' },
  { to: '/sportsbook', title: 'Sportsbook', body: 'Primeira Liga & World Cup. Build a bet slip.' },
  { to: '/poker', title: 'Poker', body: "Texas Hold'em vs bots and friends." },
  { to: '/friends', title: 'Friends', body: 'Presence, leaderboards & challenges.' },
];

export function HomePage() {
  const { user } = useAuth();
  return (
    <div className="animate-fade-in space-y-8">
      {user && <DailyBonusCard />}
      <section className="card relative overflow-hidden p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-bg/50 px-3 py-1 text-xs text-muted">
            <CoinIcon className="h-3.5 w-3.5" />
            Play money only — no real currency involved
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-text">
            Welcome to Arent<span className="text-gold">im</span>
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            A social casino and football sportsbook for friends. Every account starts with{' '}
            <span className="font-semibold text-text">5.000 Tostões</span>. It is just for fun.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {tiles.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="card focus-ring group p-6 transition-colors hover:border-accent/50"
          >
            <h2 className="font-display text-lg font-semibold text-text group-hover:text-gold">
              {tile.title}
            </h2>
            <p className="mt-1 text-sm text-muted">{tile.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
