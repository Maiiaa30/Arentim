import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProfile } from '@/features/profile/useProfile';
import { useSlotMachines, usePlaySlot } from '@/features/casino/useSlotMachines';
import { accentHex } from '@/features/casino/slotTheme';
import { WinCelebration } from '@/features/casino/WinCelebration';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { CoinIcon } from '@/components/CoinIcon';
import { formatAmount } from '@/lib/format';
import type { SlotMachineMeta } from '@/types/db';

const DENOMS = [5, 10, 25, 50, 100, 250];

/** One reel window. Cycles random glyphs while spinning, then snaps to target. */
function Reel({
  glyphs,
  target,
  spinning,
  won,
  accent,
}: {
  glyphs: string[];
  target: string;
  spinning: boolean;
  won: boolean;
  accent: string;
}) {
  const [shown, setShown] = useState(target);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (spinning) {
      timer.current = window.setInterval(() => {
        setShown(glyphs[Math.floor(Math.random() * glyphs.length)]!);
      }, 70);
      return () => {
        if (timer.current) window.clearInterval(timer.current);
      };
    }
    setShown(target);
    return;
  }, [spinning, target, glyphs]);

  return (
    <div
      className={`relative flex h-28 w-[78px] items-center justify-center overflow-hidden rounded border-2 bg-bg/80 transition-colors sm:h-32 sm:w-24 ${
        won && !spinning ? 'border-gold animate-glow' : 'border-gold/25'
      }`}
      style={won && !spinning ? { boxShadow: `inset 0 0 24px ${accent}55` } : undefined}
    >
      {/* glass shading */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-black/30" />
      <span
        key={spinning ? 'spin' : shown}
        className={`text-5xl sm:text-[56px] ${spinning ? 'blur-[1.5px]' : 'animate-pop'}`}
      >
        {shown}
      </span>
    </div>
  );
}

function MachineScreen({ m }: { m: SlotMachineMeta }) {
  const { data: profile } = useProfile();
  const play = usePlaySlot();
  const hex = accentHex(m.accent);

  const glyphById = useMemo(
    () => Object.fromEntries(m.symbols.map((s) => [s.id, s.glyph])),
    [m.symbols],
  );
  const allGlyphs = useMemo(() => m.symbols.map((s) => s.glyph), [m.symbols]);
  const jackpotGlyph = glyphById[m.jackpot_symbol] ?? '✦';
  const maxVisible = useMemo(
    () => Math.max(0, ...m.paytable.filter((r) => r.mult != null).map((r) => r.mult as number)),
    [m.paytable],
  );

  const betOptions = useMemo(() => {
    const set = new Set<number>([m.min_bet, m.max_bet, ...DENOMS.filter((d) => d >= m.min_bet && d <= m.max_bet)]);
    return [...set].sort((a, b) => a - b);
  }, [m.min_bet, m.max_bet]);

  const balance = profile?.balance ?? 0;
  const [stake, setStake] = useState(m.min_bet);
  const initial = m.symbols.slice(0, 3).map((s) => s.glyph);
  const [targets, setTargets] = useState<string[]>([initial[0]!, initial[1]!, initial[2]!]);
  const [spin, setSpin] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [result, setResult] = useState<{ payout: number; jackpot: boolean; mult: number; id: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const spinId = useRef(0);

  // Clamp the stake into range when the machine changes; clear pending timers.
  useEffect(() => {
    setStake((s) => Math.min(m.max_bet, Math.max(m.min_bet, s)));
  }, [m.min_bet, m.max_bet]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const anySpinning = spin.some(Boolean);
  const won = !anySpinning && (result?.payout ?? 0) > 0;

  async function onSpin() {
    if (anySpinning || stake > balance || stake < m.min_bet) return;
    setError(null);
    setResult(null);
    setSpin([true, true, true]);
    try {
      const res = await play.mutateAsync({ machine: m.key, stake });
      const glyphs = res.reels.map((id) => glyphById[id] ?? '❔');
      setTargets(glyphs);
      const id = ++spinId.current;
      // Staggered reel stops for suspense, then reveal the outcome.
      timers.current.push(
        window.setTimeout(() => setSpin((s) => [false, s[1], s[2]]), 620),
        window.setTimeout(() => setSpin((s) => [false, false, s[2]]), 980),
        window.setTimeout(() => {
          setSpin([false, false, false]);
          setResult({ payout: res.payout, jackpot: res.jackpot, mult: res.multiplier, id });
        }, 1340),
      );
    } catch (e) {
      setSpin([false, false, false]);
      setError(e instanceof Error ? e.message : 'A rodada falhou.');
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/casino/slots" className="font-sans text-sm text-muted-2 hover:text-text">← Slots</Link>
        <Eyebrow className="mt-3">Máquina</Eyebrow>
        <h1 className="mt-2 font-display text-[36px] font-medium leading-tight text-text">{m.name}</h1>
        <p className="mt-2 font-sans text-sm text-muted">{m.blurb}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* Cabinet — ornate gilded frame around a themed reel housing */}
        <div
          className="rounded-xl p-[3px] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
          style={{ background: `linear-gradient(155deg, #f7e4ad, ${hex}, #5b4824)` }}
        >
          <div
            className="relative overflow-hidden rounded-[9px] p-5 sm:p-6"
            style={{
              background: `radial-gradient(135% 90% at 50% -10%, ${hex}38, transparent 55%), linear-gradient(180deg, #171309, #0a0907 75%)`,
            }}
          >
            {/* Marquee */}
            <div className="mb-4 text-center">
              <p className="font-sans text-[8.5px] uppercase tracking-[0.4em] text-muted-2">Arentim Slots</p>
              <h2
                className="font-display text-[26px] font-bold leading-tight"
                style={{ color: hex, textShadow: `0 0 18px ${hex}66` }}
              >
                {m.name}
              </h2>
              <p className="mt-0.5 font-sans text-[10.5px] uppercase tracking-[0.22em] text-gold-light">
                Prémios até {maxVisible}× · Jackpot <span className="font-bold">???</span>
              </p>
            </div>

            {/* Mystery jackpot meter */}
            <div
              className={`mx-auto mb-5 flex max-w-sm items-center justify-center gap-3 rounded border px-4 py-2 ${
                result?.jackpot ? 'animate-jackpot-flash' : ''
              }`}
              style={{ borderColor: `${hex}66`, background: `linear-gradient(180deg, ${hex}22, transparent)` }}
            >
              <span className="animate-glow rounded-full text-2xl" aria-hidden>{jackpotGlyph}</span>
              <div className="text-center">
                <p className="font-sans text-[9px] uppercase tracking-[0.3em] text-muted-2">Jackpot Mistério</p>
                <p className="font-display text-xl font-bold" style={{ color: hex }}>
                  {result?.jackpot ? `${formatAmount(result.payout)} tós!` : '? ? ?'}
                </p>
              </div>
            </div>

            {/* Reel housing with a gilded centre payline */}
            <div
              className="relative mx-auto max-w-md rounded-md p-2.5"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.3))',
                boxShadow: 'inset 0 0 0 1px rgba(201,162,75,0.35), inset 0 0 30px rgba(0,0,0,0.6)',
              }}
            >
              <div className="relative flex justify-center gap-2.5 sm:gap-3.5">
                <span
                  className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-[2px] -translate-y-1/2"
                  style={{ background: `linear-gradient(90deg, transparent, ${hex}, transparent)` }}
                  aria-hidden
                />
                <Reel glyphs={allGlyphs} target={targets[0]!} spinning={spin[0]} won={won} accent={hex} />
                <Reel glyphs={allGlyphs} target={targets[1]!} spinning={spin[1]} won={won} accent={hex} />
                <Reel glyphs={allGlyphs} target={targets[2]!} spinning={spin[2]} won={won} accent={hex} />
                {won && result && <WinCelebration key={result.id} jackpot={result.jackpot} />}
              </div>
            </div>

            {/* Outcome line */}
            <div className="mt-5 flex h-9 items-center justify-center text-center">
              {anySpinning ? (
                <p className="font-sans text-sm text-muted">A rodar…</p>
              ) : result?.jackpot ? (
                <p className="animate-pop font-display text-2xl font-bold" style={{ color: hex }}>
                  ✦ JACKPOT ✦ {formatAmount(result.payout)} Tostões!
                </p>
              ) : result && result.payout > 0 ? (
                <p className="animate-pop font-display text-lg font-bold text-positive">
                  Ganhou {formatAmount(result.payout)} Tostões! ({result.mult}×)
                </p>
              ) : result ? (
                <p className="font-sans text-sm text-muted">Sem prémio — gire outra vez.</p>
              ) : (
                <p className="font-sans text-sm text-muted-2">Faça a sua aposta e gire.</p>
              )}
            </div>
          </div>
        </div>

        {/* Controls + paytable */}
        <div className="space-y-4">
          <div className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Aposta</span>
              <span className="flex items-center gap-1 font-mono text-xs text-muted-2">
                <CoinIcon className="h-3.5 w-3.5" /> {formatAmount(balance)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {betOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={anySpinning || c > balance}
                  onClick={() => setStake(c)}
                  className={`focus-ring rounded px-3 py-1.5 font-mono text-sm font-semibold transition-colors disabled:opacity-40 ${
                    stake === c ? 'bg-gold text-bg' : 'border border-border text-muted hover:text-text'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <Button
              variant="primary"
              onClick={onSpin}
              disabled={anySpinning || stake > balance || stake < m.min_bet}
              className="w-full"
            >
              {anySpinning ? 'A rodar…' : `Girar · ${formatAmount(stake)}`}
            </Button>
            {stake > balance && <p className="font-sans text-xs text-negative">Saldo insuficiente para esta aposta.</p>}
            {error && <p className="font-sans text-sm text-negative">{error}</p>}
          </div>

          <div className="card p-5">
            <p className="mb-3 font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">
              Tabela de prémios <span className="text-faint">(× a aposta)</span>
            </p>
            <ul className="space-y-1.5">
              {m.paytable.map((row) => {
                const isJackpot = row.id === m.jackpot_symbol;
                return (
                  <li
                    key={row.id}
                    className={`flex items-center justify-between rounded px-2 py-1 ${
                      isJackpot ? 'bg-gold/[0.08]' : ''
                    }`}
                  >
                    <span className="text-lg">{row.glyph}{row.glyph}{row.glyph}</span>
                    {isJackpot ? (
                      <span className="font-display text-sm font-bold" style={{ color: hex }}>JACKPOT ?</span>
                    ) : (
                      <span className="font-mono text-sm text-text">{row.mult}×</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 font-sans text-[11px] leading-relaxed text-muted-2">
              Três iguais pagam o prémio cheio; alguns pares também pagam. O jackpot é o segredo da casa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SlotMachinePage() {
  const { key } = useParams<{ key: string }>();
  const { data: machines, isLoading } = useSlotMachines();
  const machine = machines?.find((m) => m.key === key);

  if (isLoading) return <p className="py-16 text-center text-muted">A acender a máquina…</p>;
  if (!machine) {
    return (
      <div className="animate-fade-in space-y-4 py-12 text-center">
        <p className="text-muted">Essa máquina não existe.</p>
        <Link to="/casino/slots" className="font-sans text-sm text-gold hover:underline">← Voltar às Slots</Link>
      </div>
    );
  }
  return <MachineScreen m={machine} />;
}
