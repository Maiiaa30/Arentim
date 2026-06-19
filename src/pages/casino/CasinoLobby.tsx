import { Link } from 'react-router-dom';
import { Eyebrow, SectionHeader } from '@/components/ui/primitives';

interface GameTile {
  to: string;
  title: string;
  body: string;
  available: boolean;
}

const GAMES: GameTile[] = [
  { to: '/casino/roulette', title: 'Roleta', body: 'Roleta europeia, zero único.', available: true },
  { to: '/casino/slots', title: 'Slots', body: 'Três rolos, tema Arentim.', available: true },
  { to: '/casino/coinflip', title: 'Moeda', body: 'Dobro ou nada, prémio par.', available: true },
  { to: '/casino/blackjack', title: 'Blackjack', body: 'Pedir, ficar, dobrar, dividir.', available: true },
];

export function CasinoLobby() {
  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Eyebrow>O Salão</Eyebrow>
        <h1 className="mt-2 font-display text-[38px] font-medium leading-tight text-text">Casino</h1>
        <p className="mt-2 font-sans text-sm text-muted">
          Jogos transparentes, semeados no servidor. Apenas dinheiro de brincadeira.
        </p>
      </div>

      <div className="space-y-5">
        <SectionHeader title="As Mesas" right="Salão" />
        <div className="grid gap-4 sm:grid-cols-2">
          {GAMES.map((g) =>
            g.available ? (
              <Link
                key={g.to}
                to={g.to}
                className="card card-hover focus-ring group p-6"
              >
                <h2 className="font-display text-[22px] font-semibold text-text group-hover:text-gold">
                  {g.title}
                </h2>
                <p className="mt-1 font-sans text-sm text-muted">{g.body}</p>
              </Link>
            ) : (
              <div key={g.to} className="card p-6 opacity-60">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-[22px] font-semibold text-muted">{g.title}</h2>
                  <span className="rounded-full border border-border px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.18em] text-muted">
                    Em breve
                  </span>
                </div>
                <p className="mt-1 font-sans text-sm text-muted">{g.body}</p>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
