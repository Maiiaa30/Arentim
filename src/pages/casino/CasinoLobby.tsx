import { Link } from 'react-router-dom';
import { Eyebrow, FramedPanel, SectionHeader } from '@/components/ui/primitives';
import { GameArt, type GameArtKind } from '@/features/casino/GameArt';

interface GameTile {
  to: string;
  name: string;
  desc: string;
  art: GameArtKind;
  badge?: string;
  tone: string; // artwork gradient
  range: string; // bet range
}

const NEW: GameTile[] = [
  { to: '/casino/crash', name: 'Crash', desc: 'Saia antes do foguetão rebentar. Multiplicador sem limite.', art: 'crash', badge: 'Novo', tone: 'from-chip-ruby/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/wheel', name: 'Roda da Sorte', desc: 'Rode e leve o multiplicador onde a seta parar — até 10×.', art: 'wheel', badge: 'Novo', tone: 'from-gold/30 to-bg', range: '5 – 100 tós' },
  { to: '/casino/sobe-e-desce', name: 'Sobe e Desce', desc: 'A marca sobe a escada. Aposte se passa dos sete — ou para onde vai.', art: 'sobedesce', badge: 'Novo', tone: 'from-positive-felt/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/dice', name: 'Dados', desc: 'Dois dados. Mais de 7, menos de 7, ou certo no sete.', art: 'dice', badge: 'Novo', tone: 'from-chip-navy/40 to-bg', range: '5 – 100 tós' },
];

const TABLES: GameTile[] = [
  { to: '/casino/roulette', name: 'Roleta', desc: 'Roleta europeia, zero único. Números, cores ou dúzias.', art: 'roulette', badge: 'Em alta', tone: 'from-chip-ruby/40 to-bg', range: '5 – 500 tós' },
  { to: '/casino/blackjack', name: 'Blackjack', desc: 'Pedir, ficar, dobrar, dividir. O croupier pára nos 17.', art: 'blackjack', tone: 'from-positive-felt/40 to-bg', range: '10 – 500 tós' },
  { to: '/poker', name: 'Poker', desc: 'Texas Hold’em contra bots ou amigos numa mesa privada.', art: 'poker', tone: 'from-chip-navy/40 to-bg', range: '100+ tós' },
];

const QUICK: GameTile[] = [
  { to: '/casino/slots', name: 'Slots', desc: 'Cinco máquinas temáticas e um pote progressivo.', art: 'slots', badge: '5 máquinas', tone: 'from-gold/30 to-bg', range: '5 – 1000 tós' },
  { to: '/casino/coinflip', name: 'Moeda', desc: 'Cara ou coroa — dobro ou nada, prémio par.', art: 'coinflip', badge: 'Rápido', tone: 'from-gold-light/30 to-bg', range: '5 – 500 tós' },
];

function GameCard({ g, featured }: { g: GameTile; featured?: boolean }) {
  return (
    <Link
      to={g.to}
      className="card card-hover focus-ring group flex flex-col overflow-hidden transition-transform duration-300 ease-aretim hover:-translate-y-1"
    >
      <div className={`relative ${featured ? 'h-[156px]' : 'h-[132px]'} bg-gradient-to-br ${g.tone}`}>
        <GameArt kind={g.art} />
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: 'radial-gradient(420px 180px at 50% -20%, rgba(201,162,75,0.18), transparent 70%)' }}
          aria-hidden
        />
        {g.badge && (
          <span className="absolute left-3 top-3 rounded-full border border-gold/40 bg-bg/60 px-2.5 py-0.5 font-sans text-[9px] font-medium uppercase tracking-[0.18em] text-gold backdrop-blur-sm">
            {g.badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[24px] font-semibold leading-tight text-text transition-colors group-hover:text-gold">
          {g.name}
        </h3>
        <p className="mt-1.5 flex-1 font-sans text-[12.5px] leading-relaxed text-muted">{g.desc}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-xs text-muted-2">{g.range}</span>
          <span className="min-h-[40px] rounded border border-gold/40 px-4 py-2 font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-gold transition-colors group-hover:bg-gold group-hover:text-bg">
            Entrar
          </span>
        </div>
      </div>
    </Link>
  );
}

function Section({ title, right, games, featured }: { title: string; right?: string; games: GameTile[]; featured?: boolean }) {
  return (
    <div className="space-y-5">
      <SectionHeader title={title} right={right} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-4 sm:gap-[18px]">
        {games.map((g) => (
          <GameCard key={g.to} g={g} featured={!!featured} />
        ))}
      </div>
    </div>
  );
}

export function CasinoLobby() {
  return (
    <div className="animate-fade-in space-y-12">
      <FramedPanel>
        <div className="max-w-xl">
          <Eyebrow>O Salão</Eyebrow>
          <h1 className="mt-3 font-display text-[40px] font-medium leading-[1.05] text-text sm:text-[44px]">
            Entre no <span className="italic text-gold">Casino.</span>
          </h1>
          <p className="mt-4 font-sans text-[15px] leading-relaxed text-muted">
            Jogos transparentes, semeados no servidor — cada giro e cada carta é verificável. É tudo a
            brincar, só dinheiro de mentira.
          </p>
        </div>
      </FramedPanel>

      <Section title="Novidades" right="Acabadas de chegar" games={NEW} featured />
      <Section title="As Mesas" right="Clássicos" games={TABLES} />
      <Section title="Rápidos" right="Uma jogada" games={QUICK} />
    </div>
  );
}
