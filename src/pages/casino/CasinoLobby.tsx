import { Link } from 'react-router-dom';

interface GameTile {
  to: string;
  title: string;
  body: string;
  available: boolean;
}

const GAMES: GameTile[] = [
  { to: '/casino/roulette', title: 'Roulette', body: 'European single-zero wheel.', available: true },
  { to: '/casino/blackjack', title: 'Blackjack', body: 'Hit, stand, double, split.', available: false },
  { to: '/casino/slots', title: 'Slots', body: 'Three-reel, Arentim-themed.', available: false },
  { to: '/casino/quick', title: 'Quick games', body: 'Dice, crash & coin-flip.', available: false },
];

export function CasinoLobby() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Casino</h1>
        <p className="mt-1 text-sm text-muted">Transparent, server-seeded games. Play money only.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((g) =>
          g.available ? (
            <Link
              key={g.to}
              to={g.to}
              className="card focus-ring group p-6 transition-colors hover:border-accent/50"
            >
              <h2 className="font-display text-lg font-semibold text-text group-hover:text-gold">
                {g.title}
              </h2>
              <p className="mt-1 text-sm text-muted">{g.body}</p>
            </Link>
          ) : (
            <div key={g.to} className="card p-6 opacity-60">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-muted">{g.title}</h2>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                  Soon
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{g.body}</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
