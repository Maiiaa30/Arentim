import { Link } from 'react-router-dom';
import { Eyebrow, FramedPanel } from '@/components/ui/primitives';
import { UiIcon } from '@/components/icons/UiIcon';

/** A small muted info pill — pace, players, rules. */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border px-3 py-1 font-sans text-[11px] text-muted-2">{children}</span>
  );
}

/** A choosable sueca mode — suit emblem, title, blurb, meta line and a gold CTA. */
function ModeCard({ to, suit, title, desc, meta }: { to: string; suit: string; title: string; desc: string; meta: string }) {
  const red = suit === '♥' || suit === '♦';
  return (
    <Link to={to} className="card card-hover focus-ring group relative flex flex-col gap-5 overflow-hidden p-6">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-lg border text-2xl leading-none ${
          red ? 'border-chip-ruby/30 bg-chip-ruby/10 text-chip-ruby' : 'border-gold/25 bg-gold/10 text-gold'
        }`}
        aria-hidden
      >
        {suit}
      </span>
      <div className="flex-1">
        <h2 className="font-display text-[22px] font-semibold text-text transition-colors group-hover:text-gold">{title}</h2>
        <p className="mt-2 font-sans text-[12.5px] leading-relaxed text-muted">{desc}</p>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <span className="font-sans text-[11.5px] text-muted-2">{meta}</span>
        <UiIcon name="arrowRight" className="h-4 w-4 text-gold transition-transform duration-300 group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

export function SuecaHome() {
  return (
    <div className="animate-fade-in space-y-8">
      <Link to="/" className="font-sans text-sm text-muted-2 hover:text-text">← Voltar às Mesas</Link>

      <FramedPanel>
        <div className="flex items-center justify-between gap-8">
          <div className="max-w-xl">
            <Eyebrow>Jogos de Mesa</Eyebrow>
            <h1 className="mt-3 font-display text-[40px] font-medium leading-[1.04] text-text sm:text-[44px]">
              <span className="italic text-gold">Sueca</span>
            </h1>
            <p className="mt-3 font-sans text-[14.5px] leading-relaxed text-muted">
              O clássico português a 4 — duas duplas, 40 cartas, trunfo do baralhador. O Ás e o 7 mandam;
              quem passar dos 60 ganha a mão (90+ dobra, 120 é capote).
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Pill>4 jogadores</Pill>
              <Pill>2 duplas</Pill>
              <Pill>60 para ganhar</Pill>
            </div>
          </div>
          {/* The four suits — the hero's emblem, hidden on phones. */}
          <div className="hidden shrink-0 grid-cols-2 gap-3 sm:grid" aria-hidden>
            {['♠', '♥', '♦', '♣'].map((s) => {
              const red = s === '♥' || s === '♦';
              return (
                <span
                  key={s}
                  className={`flex h-14 w-14 items-center justify-center rounded-lg border text-3xl leading-none ${
                    red ? 'border-chip-ruby/30 bg-chip-ruby/10 text-chip-ruby/90' : 'border-gold/25 bg-gold/10 text-gold/90'
                  }`}
                >
                  {s}
                </span>
              );
            })}
          </div>
        </div>
      </FramedPanel>

      <div className="grid gap-[18px] sm:grid-cols-3">
        <ModeCard
          to="/sueca/bots"
          suit="♠"
          title="Contra bots"
          desc="Você e um parceiro-bot contra dois bots. Jogável já, sem esperas."
          meta="Tu + bot · vs 2 bots"
        />
        <ModeCard
          to="/sueca/mesa"
          suit="♥"
          title="2 contra 2 bots"
          desc="Você e um amigo numa dupla; os outros dois lugares ficam para bots."
          meta="Tu + amigo · 2 bots"
        />
        <ModeCard
          to="/sueca/mesa"
          suit="♦"
          title="Mesa completa"
          desc="Até quatro pessoas — escolham os lugares e as duplas antes de começar."
          meta="Até 4 pessoas"
        />
      </div>
    </div>
  );
}
