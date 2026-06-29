import { Link } from 'react-router-dom';
import { useCasinoActivity } from './useCasinoActivity';
import { RingAvatar } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const GAME_LABEL: Record<string, string> = {
  crash: 'no Crash',
  roulette: 'na Roleta',
  horse: 'na Corrida',
  slots: 'nas Slots',
  blackjack: 'no Blackjack',
  poker: 'no Poker',
  coinflip: 'na Moeda',
  dice: 'nos Dados',
  wheel: 'na Fita da Sorte',
  plinko: 'no Plinko',
  balatro: 'no Balatró',
  mines: 'nas Mines',
  batalha_naval: 'na Batalha Naval',
  chicken: 'no Atravessa!',
  tigrinho: 'no Tigrinho',
  chest: 'no Jogo dos Copos',
  cups: 'no Jogo dos Copos',
  highlow: 'no Maior ou Menor',
  sobedesce: 'no Sobe e Desce',
  hilo: 'no Sobe e Desce',
};

function gameName(g: string | null): string {
  if (!g) return 'no casino';
  return GAME_LABEL[g] ?? `em ${g.charAt(0).toUpperCase() + g.slice(1)}`;
}

/** One live room — a clean gold-tinted tile with a pulsing presence dot. */
function LiveRoom({ to, name, players, friends }: { to: string; name: string; players: number; friends: number }) {
  const active = players > 0;
  return (
    <Link
      to={to}
      className="focus-ring group flex items-center justify-between gap-3 rounded-xl border border-gold/20 bg-surface-raised px-4 py-3 shadow-soft transition-colors hover:border-gold/45"
    >
      <span className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${active ? 'bg-positive' : 'bg-muted-2/30'}`} />
        </span>
        <span className="font-display text-base font-medium text-text transition-colors group-hover:text-gold">{name}</span>
      </span>
      <span className="text-right leading-tight">
        {active ? (
          <>
            <span className="font-mono text-sm font-semibold text-text">{players}</span>
            <span className="font-sans text-[11px] text-muted-2"> a jogar</span>
            {friends > 0 && <span className="block font-sans text-[10px] text-gold">{friends} amigo{friends > 1 ? 's' : ''}</span>}
          </>
        ) : (
          <span className="font-sans text-[11px] text-muted-2">vazio</span>
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
  const recent = (data.recent ?? []).slice(0, 6);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-livedot rounded-full bg-positive" />
        <h2 className="font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-muted-2">Ao vivo agora</h2>
        {totalLive > 0 && <span className="font-mono text-[11px] text-gold">{totalLive} a jogar</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <LiveRoom to="/casino/crash" name="Crash" players={data.crash.players} friends={data.crash.friends} />
        <LiveRoom to="/casino/roulette" name="Roleta" players={data.roulette.players} friends={data.roulette.friends} />
        <LiveRoom to="/casino/corrida" name="Corrida" players={horse.players} friends={horse.friends} />
      </div>

      {recent.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2">
          {recent.map((r, i) => (
            <span
              key={i}
              className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3"
            >
              <RingAvatar initials={(r.is_me ? 'Tu' : r.name).slice(0, 2).toUpperCase()} size={22} tone={r.is_me ? 'gold' : 'muted'} />
              <span className="truncate font-sans text-[11.5px] text-muted">
                <span className={r.is_me ? 'font-semibold text-gold' : 'font-medium text-text'}>{r.is_me ? 'Tu' : r.name}</span>{' '}
                <span className="font-mono text-positive">{formatAmount(r.amount)}</span> {gameName(r.game)}
              </span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
