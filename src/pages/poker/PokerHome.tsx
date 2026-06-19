import { Link } from 'react-router-dom';

export function PokerHome() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Poker</h1>
        <p className="mt-1 text-sm text-muted">Texas Hold'em — server deals, hole cards stay private.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/poker/bots" className="card focus-ring group p-6 transition-colors hover:border-accent/50">
          <h2 className="font-display text-lg font-semibold text-text group-hover:text-gold">Play vs bots</h2>
          <p className="mt-1 text-sm text-muted">Single-player table against 1–5 AI opponents.</p>
        </Link>
        <Link to="/poker/private" className="card focus-ring group p-6 transition-colors hover:border-accent/50">
          <h2 className="font-display text-lg font-semibold text-text group-hover:text-gold">Private table</h2>
          <p className="mt-1 text-sm text-muted">Create a table, invite friends with a code, fill seats with bots.</p>
        </Link>
      </div>
    </div>
  );
}
