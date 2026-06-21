import { Link } from 'react-router-dom';
import { useCasinoActivity } from './useCasinoActivity';
import { formatAmount } from '@/lib/format';

const GAME_LABEL: Record<string, string> = {
  crash: 'Crash',
  roulette: 'Roleta',
  slots: 'Slots',
  blackjack: 'Blackjack',
  coinflip: 'Moeda',
  dice: 'Dados',
  wheel: 'Fita da Sorte',
};

function gameName(g: string | null): string {
  if (!g) return 'no casino';
  return GAME_LABEL[g] ?? g.charAt(0).toUpperCase() + g.slice(1);
}

function LiveRow({ to, name, players, friends }: { to: string; name: string; players: number; friends: number }) {
  return (
    <Link
      to={to}
      className="focus-ring flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5 transition-colors hover:border-gold/40"
    >
      <span className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          {players > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${players > 0 ? 'bg-positive' : 'bg-muted-2/40'}`} />
        </span>
        <span className="font-display text-sm font-medium text-text">{name}</span>
      </span>
      <span className="font-sans text-[12px] text-muted-2">
        {players === 0 ? (
          'Ninguém a jogar'
        ) : (
          <>
            <span className="font-semibold text-text">{players}</span> a jogar
            {friends > 0 && <span className="text-gold"> · {friends} amigo{friends > 1 ? 's' : ''}</span>}
          </>
        )}
      </span>
    </Link>
  );
}

/** Live lobby strip: who's in the shared rooms now + a recent big-wins ticker. */
export function CasinoActivity() {
  const { data } = useCasinoActivity();
  if (!data) return null;

  const horse = data.horse ?? { players: 0, friends: 0 };
  const totalLive = data.crash.players + data.roulette.players + horse.players;
  const recent = data.recent ?? [];

  return (
    <div className="rounded-xl border border-border bg-surface-raised/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 animate-livedot rounded-full bg-positive" />
        <span className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-muted-2">Ao vivo agora</span>
        {totalLive > 0 && <span className="font-mono text-[10px] text-gold">{totalLive} a jogar</span>}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <LiveRow to="/casino/crash" name="Crash" players={data.crash.players} friends={data.crash.friends} />
        <LiveRow to="/casino/roulette" name="Roleta" players={data.roulette.players} friends={data.roulette.friends} />
        <LiveRow to="/casino/corrida" name="Corrida" players={horse.players} friends={horse.friends} />
      </div>

      {recent.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="mb-1.5 font-sans text-[9px] uppercase tracking-[0.2em] text-muted-2">Prémios recentes</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {recent.map((r, i) => (
              <li key={i} className="font-sans text-[12px] text-muted">
                <span className={r.is_me ? 'font-semibold text-gold' : 'font-medium text-text'}>{r.is_me ? 'Tu' : r.name}</span>{' '}
                ganhou <span className="font-mono text-positive">{formatAmount(r.amount)}</span> {gameName(r.game)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
