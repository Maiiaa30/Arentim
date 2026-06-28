import { useCasinoActivity } from './useCasinoActivity';
import { useProfile } from '@/features/profile/useProfile';
import { CornerBrackets } from '@/components/ui/primitives';
import { formatAmount, formatTos } from '@/lib/format';

/** One live metric — muted label over a mono figure, on a raised tile. */
function Stat({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'positive' | 'text' }) {
  const color = tone === 'positive' ? 'text-positive' : tone === 'gold' ? 'text-gold' : 'text-text';
  return (
    <div className="rounded-lg border border-gold/15 bg-surface-raised px-4 py-3">
      <p className="font-sans text-[10.5px] uppercase tracking-[0.14em] text-muted-2">{label}</p>
      <p className={`mt-1 font-mono text-lg leading-none ${color}`}>{value}</p>
    </div>
  );
}

/**
 * Live-pulse hero for the casino lobby. No marketing copy — the headline is the
 * live player count and the stats are real: biggest win today, open rooms, your
 * balance. Falls back to a calm "open" state when the floor is quiet.
 */
export function CasinoHero() {
  const { data } = useCasinoActivity();
  const { data: profile } = useProfile();

  const horse = data?.horse ?? { players: 0 };
  const rooms = [data?.crash.players ?? 0, data?.roulette.players ?? 0, horse.players];
  const totalLive = rooms.reduce((a, b) => a + b, 0);
  const roomsOpen = rooms.filter((p) => p > 0).length;
  const biggestWin = (data?.recent ?? []).reduce((max, r) => Math.max(max, r.amount), 0);

  return (
    <section
      className="relative overflow-hidden rounded-lg border border-gold/30 p-7 sm:p-9"
      style={{ background: 'linear-gradient(120deg,#17130b 0%,#0d0b07 58%,#0b0e0b 100%)' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(560px 320px at 88% -20%, rgba(201,162,75,0.18), transparent 60%), radial-gradient(420px 300px at -5% 130%, rgba(31,138,91,0.12), transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute -right-6 top-1/2 hidden -translate-y-1/2 select-none font-display text-[200px] leading-none text-gold/[0.04] sm:block"
        aria-hidden
      >
        ♠
      </div>
      <CornerBrackets />

      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {totalLive > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${totalLive > 0 ? 'bg-positive' : 'bg-muted-2/40'}`} />
          </span>
          <span className="font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-muted-2">Ao vivo agora</span>
        </div>

        <h1 className="mt-3 font-display text-[34px] font-medium leading-[1.05] text-text sm:text-[40px]">
          {totalLive > 0 ? (
            <>
              Há <span className="text-gold">{totalLive} {totalLive === 1 ? 'pessoa' : 'pessoas'}</span> a jogar.
            </>
          ) : (
            <>
              O <span className="italic text-gold">Salão</span> está aberto.
            </>
          )}
        </h1>

        <p className="mt-3 font-sans text-[13px] leading-relaxed text-muted">
          Jogos justos, semeados no servidor — cada giro e cada carta é verificável. Tudo a brincar, só dinheiro de mentira.
        </p>

        <div className="mt-6 grid max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Stat label="Maior ganho hoje" value={biggestWin > 0 ? `+${formatAmount(biggestWin)}` : '—'} tone="positive" />
          <Stat label="Salas ao vivo" value={`${roomsOpen} / 3`} tone="gold" />
          <Stat label="O teu saldo" value={profile ? formatTos(profile.balance) : '—'} tone="text" />
        </div>
      </div>
    </section>
  );
}
