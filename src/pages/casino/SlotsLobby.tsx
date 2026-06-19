import { Link } from 'react-router-dom';
import { useSlotMachines } from '@/features/casino/useSlotMachines';
import { accentHex } from '@/features/casino/slotTheme';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import type { SlotMachineMeta } from '@/types/db';

function MachineCard({ m }: { m: SlotMachineMeta }) {
  const hex = accentHex(m.accent);
  const jackpotGlyph = m.symbols.find((s) => s.id === m.jackpot_symbol)?.glyph ?? '✦';
  const showcase = m.symbols.slice(0, 3).map((s) => s.glyph);

  return (
    <Link
      to={`/casino/slots/${m.key}`}
      className="card card-hover focus-ring group relative flex flex-col overflow-hidden"
    >
      {/* Themed marquee */}
      <div
        className="relative flex h-[132px] items-center justify-center gap-2 overflow-hidden"
        style={{ background: `radial-gradient(120% 130% at 50% -20%, ${hex}40, transparent 60%), linear-gradient(180deg, #100e09, #0a0907)` }}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${hex}, transparent)` }}
        />
        {showcase.map((g, i) => (
          <span
            key={i}
            className="text-[40px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:-translate-y-0.5"
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            {g}
          </span>
        ))}
        <span
          className="absolute right-3 top-3 flex items-center gap-1 rounded-full border px-2 py-0.5 font-sans text-[9px] uppercase tracking-[0.18em]"
          style={{ borderColor: `${hex}66`, color: hex, background: 'rgba(10,9,7,0.6)' }}
        >
          {jackpotGlyph} Jackpot mistério
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[22px] font-semibold text-text group-hover:text-gold">{m.name}</h3>
        <p className="mt-1 flex-1 font-sans text-[12.5px] leading-relaxed text-muted">{m.blurb}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-xs text-muted-2">
            {formatAmount(m.min_bet)} – {formatAmount(m.max_bet)} tós
          </span>
          <span className="rounded border border-gold/40 px-3 py-1 font-sans text-[10px] uppercase tracking-[0.18em] text-gold transition-colors group-hover:bg-gold group-hover:text-bg">
            Jogar
          </span>
        </div>
      </div>
    </Link>
  );
}

export function SlotsLobby() {
  const { data: machines, isLoading, error } = useSlotMachines();

  return (
    <div className="animate-fade-in space-y-7">
      <div>
        <Link to="/casino" className="font-sans text-sm text-muted-2 hover:text-text">← Casino</Link>
        <Eyebrow className="mt-3">O Salão de Slots</Eyebrow>
        <h1 className="mt-2 font-display text-[40px] font-medium leading-[1.04] text-text">Slots</h1>
        <p className="mt-3 max-w-xl font-sans text-[15px] leading-relaxed text-muted">
          Cinco máquinas, cinco temas. Cada uma esconde o seu próprio jackpot — raro, mas a
          qualquer rodada pode sair. A <span className="text-gold">Aurélia Royal</span> guarda o maior de todos.
        </p>
      </div>

      {isLoading && <p className="py-12 text-center text-muted">A acender as máquinas…</p>}
      {error && (
        <p className="py-12 text-center text-negative">
          Não foi possível carregar as slots. Atualize a página.
        </p>
      )}

      {machines && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-[18px]">
          {machines.map((m) => (
            <MachineCard key={m.key} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
