import { Eyebrow, FramedPanel, SectionHeader } from '@/components/ui/primitives';
import { CasinoActivity } from '@/features/casino/CasinoActivity';
import { GameCard, type GameTile } from '@/features/casino/GameCard';
import { useGameSwitches } from '@/features/admin/useAdmin';

/** A game tile's switch key is the last path segment ('/casino/crash' → 'crash'). */
const switchKey = (g: GameTile) => g.to.split('/').filter(Boolean).pop() ?? '';

// Shared live rooms — one global round everyone watches together.
const LIVE: GameTile[] = [
  { to: '/casino/crash', name: 'Crash', desc: 'Sala ao vivo. Sai antes do foguetão rebentar.', art: 'crash', badge: 'Ao vivo', tone: 'from-chip-ruby/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/roulette', name: 'Roleta', desc: 'Mesa ao vivo. Todos veem a mesma bola cair.', art: 'roulette', badge: 'Ao vivo', tone: 'from-chip-ruby/40 to-bg', range: '5 – 500 tós' },
  { to: '/casino/corrida', name: 'Corrida de Cavalos', desc: 'Corrida ao vivo. Escolhe o teu cavalo.', art: 'horse', badge: 'Ao vivo', tone: 'from-chip-navy/40 to-bg', range: '5 – 100 tós' },
];

// Bigger sit-down games + the slots floor.
const TABLES: GameTile[] = [
  { to: '/casino/slots', name: 'Slots', desc: 'Máquinas temáticas, pote progressivo e o Tigrinho.', art: 'slots', badge: 'Máquinas', tone: 'from-gold/30 to-bg', range: '5 – 1000 tós' },
  { to: '/casino/blackjack', name: 'Blackjack', desc: 'Pedir, ficar, dobrar, dividir. O croupier pára nos 17.', art: 'blackjack', tone: 'from-positive-felt/40 to-bg', range: '10 – 500 tós' },
  { to: '/poker', name: 'Poker', desc: 'Texas Hold’em contra bots ou amigos numa mesa privada.', art: 'poker', tone: 'from-chip-navy/40 to-bg', range: '100+ tós' },
];

// Quick single-player rounds.
const ARCADE: GameTile[] = [
  { to: '/casino/plinko', name: 'Plinko', desc: 'Larga a bola pelos pinos — quanto mais à beira, maior o prémio.', art: 'plinko', badge: 'Novo', tone: 'from-chip-ruby/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/balatro', name: 'Balatró', desc: 'Joga mãos de póquer para bater a meta. Pura perícia.', art: 'balatro', badge: 'Novo', tone: 'from-chip-navy/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/mines', name: 'Mines', desc: 'Revela diamantes e foge das minas. Retira a tempo.', art: 'mines', badge: 'Novo', tone: 'from-positive-felt/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/frango', name: 'Atravessa!', desc: 'A galinha atravessa as faixas — quanto mais longe, maior o prémio.', art: 'chicken', badge: 'Novo', tone: 'from-gold/30 to-bg', range: '5 – 100 tós' },
  { to: '/casino/wheel', name: 'Fita da Sorte', desc: 'A fita corre e pára no multiplicador — até 5×.', art: 'wheel', tone: 'from-gold/30 to-bg', range: '5 – 100 tós' },
  { to: '/casino/chest', name: 'Jogo dos Copos', desc: 'Segue a joia debaixo do copo — encontra-a por 2.85×.', art: 'chest', tone: 'from-gold/30 to-bg', range: '5 – 100 tós' },
  { to: '/casino/maior-menor', name: 'Maior ou Menor', desc: 'Um dado. Maior, menor, ou acerta no número a 5.7×.', art: 'highlow', tone: 'from-chip-navy/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/sobe-e-desce', name: 'Sobe e Desce', desc: 'Maior ou menor que a carta — as probabilidades adaptam-se.', art: 'sobedesce', tone: 'from-positive-felt/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/dice', name: 'Dados', desc: 'Dois dados. Mais de 7, menos de 7, ou certo no sete.', art: 'dice', tone: 'from-chip-navy/40 to-bg', range: '5 – 100 tós' },
  { to: '/casino/coinflip', name: 'Moeda', desc: 'Cara ou coroa — dobro ou nada.', art: 'coinflip', tone: 'from-gold-light/30 to-bg', range: '5 – 500 tós' },
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
  const { data: switches } = useGameSwitches();
  const off = new Set((switches ?? []).filter((s) => !s.enabled).map((s) => s.key));
  const show = (games: GameTile[]) => games.filter((g) => !off.has(switchKey(g)));

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

      {show(LIVE).length > 0 && <Section title="Ao vivo" right="Multijogador" games={show(LIVE)} featured />}
      {show(TABLES).length > 0 && <Section title="Mesas & Máquinas" right="Clássicos" games={show(TABLES)} />}
      {show(ARCADE).length > 0 && <Section title="Arcada" right="Uma jogada" games={show(ARCADE)} />}
    </div>
  );
}
