import { useEffect, useMemo, useState } from 'react';
import { useRaffle, useBuyTickets } from '@/features/raffle/useRaffle';
import { useProfile } from '@/features/profile/useProfile';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/CoinIcon';
import { UiIcon } from '@/components/icons/UiIcon';
import { formatAmount, formatTostoes } from '@/lib/format';
import { Eyebrow, FramedPanel, SectionHeader } from '@/components/ui/primitives';

const QUICK = [1, 5, 10, 25];

/** "2d 04:11:09" / "04:11:09" until the draw. */
function untilDraw(drawsAt: string, now: number): string {
  const ms = Math.max(0, new Date(drawsAt).getTime() - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${d}d ${clock}` : clock;
}

/** Live countdown — owns its own 1s tick so the rest of the page never re-renders. */
function Countdown({ drawsAt }: { drawsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono tabular-nums text-text">{untilDraw(drawsAt, now)}</span>;
}

export function RafflePage() {
  const { data: raffle } = useRaffle();
  const { data: profile } = useProfile();
  const buy = useBuyTickets();
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);

  const price = raffle?.ticket_price ?? 0;
  const cost = price * qty;
  const balance = profile?.balance ?? 0;
  const myOdds = useMemo(() => {
    if (!raffle || raffle.total_tickets === 0 || raffle.my_tickets === 0) return 0;
    return Math.round((raffle.my_tickets / raffle.total_tickets) * 100);
  }, [raffle]);

  async function onBuy() {
    setMsg(null);
    try {
      const res = await buy.mutateAsync(qty);
      if (res.status === 'bought') setMsg(`Comprou ${qty} bilhete(s) por ${formatTostoes(res.cost ?? cost)}.`);
      else if (res.status === 'insufficient') setMsg('Saldo insuficiente para esses bilhetes.');
      else setMsg('A rifa desta semana já fechou — vai abrir a próxima.');
    } catch {
      setMsg('Não foi possível comprar agora. Tente outra vez.');
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Hero — the pot is the star: gilded panel, big figure, live countdown. */}
      <FramedPanel className="text-center">
        <Eyebrow>Sorteio semanal</Eyebrow>
        <h1 className="mt-2 font-display text-[30px] font-medium leading-tight text-text sm:text-[36px]">
          A <span className="italic text-gold">Rifa</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md font-sans text-[13.5px] leading-relaxed text-muted">
          Compre bilhetes durante a semana. Domingo às 20h, um de vocês leva o pote inteiro.
        </p>

        <p className="mt-7 font-sans text-[11px] uppercase tracking-[0.2em] text-muted-2">Pote desta semana</p>
        <p className="mt-2 flex items-center justify-center gap-2.5 font-mono text-[44px] font-semibold leading-none text-gold sm:text-[56px]">
          <CoinIcon className="h-8 w-8 sm:h-9 sm:w-9" /> {formatAmount(raffle?.pot ?? 0)}
        </p>
        <p className="mt-4 font-sans text-sm text-muted-2">
          Sorteio em {raffle ? <Countdown drawsAt={raffle.draws_at} /> : <span className="text-text">—</span>}
        </p>

        <div className="mx-auto mt-6 flex max-w-md flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-border pt-5 font-sans text-sm text-muted-2">
          <span>{formatAmount(raffle?.total_tickets ?? 0)} bilhetes vendidos</span>
          <span>
            Os seus: <span className="font-medium text-text">{formatAmount(raffle?.my_tickets ?? 0)}</span>
            {myOdds > 0 && <span className="text-gold"> · {myOdds}% de hipóteses</span>}
          </span>
        </div>
      </FramedPanel>

      {/* Comprar bilhetes */}
      <section className="card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-medium text-text sm:text-xl">Comprar bilhetes</h2>
          <span className="font-mono text-xs text-muted-2">{formatAmount(price)} tós / bilhete</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((n) => (
            <button
              key={n}
              onClick={() => setQty(n)}
              className={`focus-ring rounded-md border px-4 py-2 font-mono text-sm transition-colors ${
                qty === n ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted-2 hover:border-gold/40'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-sans text-sm text-muted-2">
            Custo: <span className="font-mono font-medium text-text">{formatAmount(cost)} tós</span>
            <span className="ml-2 text-xs">(saldo {formatAmount(balance)})</span>
          </span>
          <Button variant="primary" onClick={onBuy} disabled={buy.isPending || cost > balance || cost === 0}>
            {buy.isPending ? 'A comprar…' : (
              <>
                <CoinIcon className="h-4 w-4" /> Comprar {qty}
              </>
            )}
          </Button>
        </div>
        {msg && <p className="animate-fade-in font-sans text-sm font-medium text-positive">{msg}</p>}
      </section>

      {/* Vencedores recentes */}
      {raffle && raffle.recent.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Vencedores recentes" />
          <div className="space-y-2">
            {raffle.recent.map((r) => (
              <div key={r.id} className="card flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-2 font-sans text-sm text-text">
                  <UiIcon name="trophy" className="h-4 w-4 text-gold" /> {r.winner_name ?? 'Sem vencedor'}
                  <span className="font-mono text-xs text-muted-2">· {formatAmount(r.total_tickets)} bilhetes</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 font-mono text-sm font-semibold text-gold">
                  <CoinIcon className="h-3.5 w-3.5" /> {formatAmount(r.pot)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
