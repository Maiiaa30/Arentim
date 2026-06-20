import { Eyebrow, FramedPanel, SectionHeader } from '@/components/ui/primitives';
import { CasinoActivity } from '@/features/casino/CasinoActivity';
import { GameCard, type GameTile } from '@/features/casino/GameCard';

const NEW: GameTile[] = [
  { to: '/casino/crash', name: 'Crash', desc: 'Saia antes do foguetão rebentar. Multiplicador sem limite.', art: 'crash', badge: 'Novo', tone: 'from-chip-ruby/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/wheel', name: 'Fita da Sorte', desc: 'A fita corre e pára no multiplicador — até 5×.', art: 'wheel', badge: 'Novo', tone: 'from-gold/30 to-bg', range: '5 – 100 tós' },
  { to: '/casino/chest', name: 'Jogo dos Copos', desc: 'Siga a joia debaixo do copo enquanto baralham — encontre-a por 2.85×.', art: 'chest', badge: 'Novo', tone: 'from-gold/30 to-bg', range: '5 – 100 tós' },
  { to: '/casino/maior-menor', name: 'Maior ou Menor', desc: 'Um dado. Maior, menor, ou acerte no número a 5.7×.', art: 'highlow', badge: 'Novo', tone: 'from-chip-navy/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/sobe-e-desce', name: 'Sobe e Desce', desc: 'Maior ou menor que o número — as probabilidades adaptam-se.', art: 'sobedesce', badge: 'Novo', tone: 'from-positive-felt/40 to-bg', range: '5 – 100 tós' },
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

      <CasinoActivity />

      <Section title="Novidades" right="Acabadas de chegar" games={NEW} featured />
      <Section title="As Mesas" right="Clássicos" games={TABLES} />
      <Section title="Rápidos" right="Uma jogada" games={QUICK} />
    </div>
  );
}
