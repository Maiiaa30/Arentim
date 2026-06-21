import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Eyebrow, FramedPanel, SectionHeader } from '@/components/ui/primitives';
import { HeroFrame } from '@/components/ui/HeroFrame';
import { GameCard, type GameTile } from '@/features/casino/GameCard';

// Visitors aren't authed, so every tile funnels to sign-up.
const SHOWCASE: GameTile[] = [
  { to: '/signup', name: 'Roleta', desc: 'Roleta europeia, zero único.', art: 'roulette', badge: 'Em alta', tone: 'from-chip-ruby/40 to-bg', cta: 'Jogar' },
  { to: '/signup', name: 'Blackjack', desc: 'O croupier pára nos 17.', art: 'blackjack', tone: 'from-positive-felt/40 to-bg', cta: 'Jogar' },
  { to: '/signup', name: 'Slots', desc: 'Cinco máquinas, jackpots secretos.', art: 'slots', badge: '5 máquinas', tone: 'from-gold/30 to-bg', cta: 'Jogar' },
  { to: '/signup', name: 'Moeda', desc: 'Cara ou coroa — dobro ou nada.', art: 'coinflip', badge: 'Novo', tone: 'from-gold-light/30 to-bg', cta: 'Jogar' },
  { to: '/signup', name: "Hold'em", desc: 'Contra bots ou amigos.', art: 'poker', tone: 'from-chip-navy/40 to-bg', cta: 'Jogar' },
  { to: '/signup', name: 'Futebol', desc: 'Primeira Liga e mais.', art: 'football', badge: 'Ao vivo', tone: 'from-positive-felt/30 to-bg', cta: 'Jogar' },
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
    desc: 'Casino, poker e futebol. Sobe na tabela do teu círculo.',
  },
];

export function LandingPage() {
  return (
    <div className="animate-fade-in space-y-12">
      {/* Hero */}
      <HeroFrame>
        <div className="max-w-2xl">
          <Eyebrow>Bem-vindo ao Arentim</Eyebrow>
          <h1 className="mt-3 font-display text-[44px] font-medium leading-[1.02] text-text sm:text-[60px]">
            A sorte está <span className="italic text-gold">lançada.</span>
          </h1>
          <p className="mt-5 max-w-xl font-sans text-[15px] leading-relaxed text-muted sm:text-[16px]">
            Uma casa de jogos só para amigos. Casino e apostas de futebol, sem
            dinheiro real — só a diversão. Cada conta começa com{' '}
            <span className="text-gold">500 Tostões</span> para apostares à
            vontade.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/signup">
              <Button variant="primary">Criar conta</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-sans text-[12px] text-muted-2">
            <span className="flex items-center gap-1.5"><span className="text-positive">✦</span> Só a brincar</span>
            <span className="flex items-center gap-1.5"><span className="text-positive">✦</span> Sem dinheiro real</span>
            <span className="flex items-center gap-1.5"><span className="text-positive">✦</span> 500 Tós de boas-vindas</span>
          </div>
        </div>
      </HeroFrame>

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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,238px),1fr))] gap-[18px]">
          {SHOWCASE.map((g) => (
            <GameCard key={g.name} g={g} />
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
