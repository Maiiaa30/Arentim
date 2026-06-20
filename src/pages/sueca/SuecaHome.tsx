import { Link } from 'react-router-dom';
import { Eyebrow } from '@/components/ui/primitives';

export function SuecaHome() {
  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Link to="/" className="font-sans text-sm text-muted-2 hover:text-text">← Voltar às Mesas</Link>
        <div className="mt-4">
          <Eyebrow>Jogos de Mesa</Eyebrow>
          <h1 className="mt-2 font-display text-[40px] font-medium leading-[1.04] text-text">Sueca</h1>
          <p className="mt-3 max-w-xl font-sans text-[15px] leading-relaxed text-muted">
            O clássico português a 4 — duas duplas, 40 cartas, trunfo do baralhador. O Ás e o 7 mandam;
            quem passar dos 60 pontos ganha a mão (90+ dobra, 120 é capote).
          </p>
        </div>
      </div>

      <div className="grid gap-[18px] sm:grid-cols-3">
        <Link to="/sueca/bots" className="card card-hover focus-ring group flex flex-col justify-between gap-6 p-6">
          <div>
            <h2 className="font-display text-[22px] font-semibold text-text group-hover:text-gold">Contra bots</h2>
            <p className="mt-2 font-sans text-[12.5px] text-muted">Você e um parceiro-bot contra dois bots. Jogável já.</p>
          </div>
          <span className="self-start rounded-full border border-gold/40 px-3 py-1 font-sans text-[10px] uppercase tracking-[0.18em] text-gold">Jogar</span>
        </Link>

        <div className="card flex flex-col justify-between gap-6 p-6 opacity-70">
          <div>
            <h2 className="font-display text-[22px] font-semibold text-text">2 contra 2 bots</h2>
            <p className="mt-2 font-sans text-[12.5px] text-muted">Dois amigos numa dupla contra dois bots, com mesa partilhada.</p>
          </div>
          <span className="self-start rounded-full border border-border px-3 py-1 font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Em breve</span>
        </div>

        <div className="card flex flex-col justify-between gap-6 p-6 opacity-70">
          <div>
            <h2 className="font-display text-[22px] font-semibold text-text">Mesa completa</h2>
            <p className="mt-2 font-sans text-[12.5px] text-muted">Quatro pessoas, a escolher as duplas antes de começar.</p>
          </div>
          <span className="self-start rounded-full border border-border px-3 py-1 font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Em breve</span>
        </div>
      </div>
    </div>
  );
}
