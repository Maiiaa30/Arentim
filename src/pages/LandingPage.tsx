import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Eyebrow, FramedPanel, SectionHeader } from '@/components/ui/primitives';
import { GameArt, type GameArtKind } from '@/features/casino/GameArt';

interface ShowcaseTile {
  to: string;
  name: string;
  desc: string;
  art: GameArtKind;
  badge?: string;
  tone: string; // artwork gradient
}

// Visitors aren't authed, so every tile funnels to sign-up.
const SHOWCASE: ShowcaseTile[] = [
  { to: '/signup', name: 'Roleta', desc: 'Roleta europeia, zero único.', art: 'roulette', badge: 'Em alta', tone: 'from-chip-ruby/40 to-bg' },
  { to: '/signup', name: 'Blackjack', desc: 'O croupier pára nos 17.', art: 'blackjack', tone: 'from-positive-felt/40 to-bg' },
  { to: '/signup', name: 'Slots', desc: 'Cinco máquinas, jackpots secretos.', art: 'slots', badge: '5 máquinas', tone: 'from-gold/30 to-bg' },
  { to: '/signup', name: 'Moeda', desc: 'Cara ou coroa — dobro ou nada.', art: 'coinflip', badge: 'Novo', tone: 'from-gold-light/30 to-bg' },
  { to: '/signup', name: "Hold'em", desc: 'Contra bots ou amigos.', art: 'poker', tone: 'from-chip-navy/40 to-bg' },
  { to: '/signup', name: 'Futebol', desc: 'Primeira Liga e mais.', art: 'football', badge: 'Ao vivo', tone: 'from-positive-felt/30 to-bg' },
];

const STEPS: { n: string; title: string; desc: string }[] = [
  {
    n: '01',
    title: 'Cria a tua conta',
    desc: 'Em segundos. Sem cartões, sem dinheiro real — nunca.',
  },
  {
    n: '02',
    title: 'Recebe 500 Tostões',
    desc: 'Cada conta começa com 500 Tós para apostar à vontade.',
  },
  {
    n: '03',
    title: 'Joga com os amigos',
    desc: 'Casino, póquer e futebol. Sobe na tabela do teu círculo.',
  },
];

function ShowcaseCard({ g }: { g: ShowcaseTile }) {
  return (
    <Link to={g.to} className="card card-hover focus-ring group flex flex-col overflow-hidden">
      <div className={`relative h-[120px] bg-gradient-to-br ${g.tone}`}>
        <GameArt kind={g.art} />
        {g.badge && (
          <span className="absolute left-3 top-3 rounded-full border border-gold/40 bg-bg/60 px-2 py-0.5 font-sans text-[9px] uppercase tracking-[0.18em] text-gold">
            {g.badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[22px] font-semibold text-text group-hover:text-gold">{g.name}</h3>
        <p className="mt-1 flex-1 font-sans text-[12.5px] text-muted">{g.desc}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-xs text-muted-2">5 – 500 tós</span>
          <span className="rounded border border-gold/40 px-3 py-1 font-sans text-[10px] uppercase tracking-[0.18em] text-gold transition-colors group-hover:bg-gold group-hover:text-bg">
            Jogar
          </span>
        </div>
      </div>
    </Link>
  );
}

export function LandingPage() {
  return (
    <div className="animate-fade-in space-y-12">
      {/* Hero */}
      <FramedPanel>
        <div className="max-w-2xl">
          <Eyebrow>Bem-vindo ao Arentim</Eyebrow>
          <h1 className="mt-3 font-display text-[40px] font-medium leading-[1.04] text-text sm:text-[56px]">
            A sorte está <span className="italic text-gold">lançada.</span>
          </h1>
          <p className="mt-5 max-w-xl font-sans text-[15px] leading-relaxed text-muted sm:text-[16px]">
            Uma casa de jogos só para amigos. Casino e apostas de futebol, sem
            dinheiro real — só a diversão. Cada conta começa com{' '}
            <span className="text-gold">500 Tostões</span> para apostares à
            vontade.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup">
              <Button variant="primary">Criar conta</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
          </div>
          <p className="mt-5 font-sans text-[12px] text-muted-2">
            Apenas a brincar. Nenhum valor é real e nada pode ser levantado.
          </p>
        </div>
      </FramedPanel>

      {/* How it works */}
      <section className="space-y-5">
        <SectionHeader title="Como funciona" right="3 passos" />
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card flex flex-col p-6">
              <span className="font-mono text-sm text-gold">{s.n}</span>
              <h3 className="mt-3 font-display text-[22px] font-semibold text-text">{s.title}</h3>
              <p className="mt-2 font-sans text-[13px] leading-relaxed text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Games showcase */}
      <section className="space-y-5">
        <SectionHeader title="As Mesas" right="Salão" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(238px,1fr))] gap-[18px]">
          {SHOWCASE.map((g) => (
            <ShowcaseCard key={g.name} g={g} />
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <FramedPanel className="text-center">
        <div className="mx-auto max-w-xl">
          <Eyebrow className="text-center">Pronto para jogar?</Eyebrow>
          <h2 className="mt-3 font-display text-[32px] font-medium leading-[1.08] text-text sm:text-[40px]">
            Junta-te ao teu <span className="italic text-gold">círculo.</span>
          </h2>
          <p className="mt-4 font-sans text-[14px] leading-relaxed text-muted">
            Cria a conta grátis, recebe os teus 500 Tós e desafia os amigos.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button variant="primary">Criar conta</Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary">Já tenho conta</Button>
            </Link>
          </div>
        </div>
      </FramedPanel>

      {/* Footer note */}
      <footer className="border-t border-border pt-6">
        <p className="font-sans text-[12px] leading-relaxed text-muted-2">
          Arentim é uma casa de jogos social, só para amigos e apenas a brincar.
          Todos os saldos são em Tostões fictícios, sem qualquer valor real — não
          há depósitos nem levantamentos. Joga com responsabilidade.
        </p>
      </footer>
    </div>
  );
}
