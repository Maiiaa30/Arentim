import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eyebrow } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { WinCelebration } from '@/features/casino/WinCelebration';
import {
  useMyBattleship,
  useBattleshipState,
  useBattleshipActions,
} from '@/features/battleship/useBattleshipTable';
import {
  BOARD,
  CELLS,
  COLS,
  FLEET,
  shipCells,
  overlaps,
  randomFleet,
  type BattleshipView,
} from '@/features/battleship/board';

const TURN_MS = 30_000;
const WATER = 'bg-[#11243c]/55 ring-1 ring-[#2b4a8b]/25';
type ShipOverlay = { cells: number[]; sunk?: boolean | undefined };

const gridPos = (i: number): CSSProperties => ({ gridColumn: (i % BOARD) + 2, gridRow: Math.floor(i / BOARD) + 2 });

/** A proper little warship drawn as SVG: pointed bow, stern, gun turrets, a
 *  bridge/superstructure, funnel and mast — scaled to the ship's length. Drawn
 *  horizontally; vertical ships reuse the same art via a 90° transform. */
function ShipSvg({ size, horizontal, sunk }: { size: number; horizontal: boolean; sunk: boolean }) {
  const gid = useId().replace(/:/g, '');
  const W = size * 100;
  // Tones: cool steel normally, charred crimson once sunk.
  const tone = sunk
    ? { top: '#9a5054', mid: '#5e2a2e', deep: '#34191c', win: '#3a1c1e', cap: '#2a1416' }
    : { top: '#e6edf6', mid: '#92a1b8', deep: '#3a4760', win: '#0c1626', cap: '#1a2230' };
  const bridgeX = Math.max(36, W * 0.3);
  const bridgeW = Math.min(76, Math.max(34, W * 0.2));
  const turrets = [W - 76, ...(size >= 3 ? [60] : [])];
  const windows = Math.max(2, Math.round(bridgeW / 16));
  const art = (
    <>
      {/* waterline shadow */}
      <ellipse cx={W / 2} cy={80} rx={W / 2 - 6} ry={9} fill="rgba(0,0,0,0.32)" />
      {/* hull — squared stern (left), pointed bow (right) */}
      <path
        d={`M 8 30 L ${W - 54} 26 Q ${W - 12} 26 ${W - 4} 50 Q ${W - 12} 74 ${W - 54} 74 L 8 70 Q 0 50 8 30 Z`}
        fill={`url(#h${gid})`}
        stroke="rgba(0,0,0,0.42)"
        strokeWidth="1.5"
      />
      {/* deck highlight + centre line */}
      <path d={`M 14 33 L ${W - 54} 30 Q ${W - 24} 31 ${W - 22} 42 L 16 45 Z`} fill="rgba(255,255,255,0.16)" />
      <path d={`M 12 50 L ${W - 28} 50`} stroke="rgba(0,0,0,0.22)" strokeWidth="1.1" />
      {/* gun turrets with barrels pointing to the bow */}
      {turrets.map((tx, i) => (
        <g key={i}>
          <line x1={tx} y1={50} x2={tx + 30} y2={50} stroke={tone.deep} strokeWidth="4" strokeLinecap="round" />
          <ellipse cx={tx} cy={50} rx={11} ry={9} fill={tone.mid} stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
        </g>
      ))}
      {/* superstructure + windows */}
      <rect x={bridgeX} y={20} width={bridgeW} height={32} rx={3} fill={tone.mid} stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
      {Array.from({ length: windows }, (_, i) => (
        <rect key={i} x={bridgeX + 6 + i * 14} y={28} width={6} height={5} rx={1} fill={tone.win} opacity="0.85" />
      ))}
      {/* funnel + cap */}
      <path d={`M ${bridgeX + bridgeW + 6} 24 L ${bridgeX + bridgeW + 10} 9 L ${bridgeX + bridgeW + 26} 9 L ${bridgeX + bridgeW + 30} 24 Z`} fill={tone.deep} />
      <rect x={bridgeX + bridgeW + 8} y={7} width={22} height={4} rx={2} fill={tone.cap} />
      {/* mast */}
      <line x1={bridgeX + 9} y1={20} x2={bridgeX + 9} y2={3} stroke={tone.deep} strokeWidth="2" />
      <line x1={bridgeX + 2} y1={9} x2={bridgeX + 16} y2={9} stroke={tone.deep} strokeWidth="1.5" />
    </>
  );
  return (
    <svg
      className="h-full w-full overflow-visible"
      viewBox={horizontal ? `0 0 ${W} 100` : `0 0 100 ${W}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`h${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone.top} />
          <stop offset="0.5" stopColor={tone.mid} />
          <stop offset="1" stopColor={tone.deep} />
        </linearGradient>
      </defs>
      {horizontal ? art : <g transform="translate(100,0) rotate(90)">{art}</g>}
    </svg>
  );
}

/** Smoke + flame that lingers over a sunk wreck. */
function SinkSmoke() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="absolute left-1/2 top-1/2 h-1.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff8a3d]/80 blur-[1px] animate-pulse" />
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute h-2.5 w-2.5 rounded-full bg-[#2f2f2f]/80 animate-smoke-slow"
          style={{ left: `${28 + i * 22}%`, top: '24%', animationDelay: `${i * 0.55}s` }}
        />
      ))}
    </div>
  );
}

/** One ship spanning its cells (across the grid gaps) so a run of cells reads as
 *  a real vessel. Lists + smokes when sunk. */
function ShipHull({ cells, sunk }: ShipOverlay) {
  const sorted = [...cells].sort((a, b) => a - b);
  const size = sorted.length;
  const horizontal = size < 2 || sorted[1]! === sorted[0]! + 1;
  const anchor = sorted[0]!;
  const r = Math.floor(anchor / BOARD);
  const c = anchor % BOARD;
  const style: CSSProperties = horizontal
    ? { gridColumn: `${c + 2} / span ${size}`, gridRow: `${r + 2}` }
    : { gridColumn: `${c + 2}`, gridRow: `${r + 2} / span ${size}` };
  return (
    <div style={style} className={`pointer-events-none relative z-10 ${sunk ? 'animate-ship-sink' : ''}`}>
      <ShipSvg size={size} horizontal={horizontal} sunk={!!sunk} />
      {sunk && <SinkSmoke />}
    </div>
  );
}

/**
 * A 10×10 ocean grid with A–J / 1–10 coordinates. Three stacked layers:
 * water cells (clickable), ship hull overlays, and shot markers on top.
 */
function OceanGrid({
  cellClass,
  ships = [],
  mark,
  onCell,
  onHover,
  onLeave,
}: {
  cellClass: (i: number) => string;
  ships?: ShipOverlay[];
  mark?: (i: number) => ReactNode;
  onCell?: (i: number) => void;
  onHover?: (i: number) => void;
  onLeave?: () => void;
}) {
  return (
    <div
      className="relative mx-auto grid aspect-square w-full max-w-[480px] select-none gap-[3px] rounded-lg p-2.5 shadow-[inset_0_2px_24px_rgba(0,0,0,0.55)] ring-1 ring-[#2b4a8b]/35"
      style={{
        gridTemplateColumns: `1.1rem repeat(${BOARD}, 1fr)`,
        gridTemplateRows: `1.1rem repeat(${BOARD}, 1fr)`,
        backgroundImage:
          'radial-gradient(55% 40% at 28% 18%, rgba(125,175,225,0.10), transparent 60%),' +
          'radial-gradient(50% 35% at 78% 72%, rgba(70,120,180,0.08), transparent 60%),' +
          'repeating-linear-gradient(0deg, rgba(150,185,220,0.045) 0 1px, transparent 1px 18px),' +
          'repeating-linear-gradient(90deg, rgba(150,185,220,0.025) 0 1px, transparent 1px 26px),' +
          'radial-gradient(130% 85% at 50% -10%, rgba(43,74,139,0.30), transparent 62%),' +
          'linear-gradient(160deg,#102339,#0a1626 55%,#06101c)',
      }}
      onMouseLeave={onLeave}
    >
      {/* Column (A–J) + row (1–10) labels — explicitly placed so they never
          get bumped by the auto-placement algorithm around the ship overlays. */}
      {COLS.map((L, c) => (
        <span key={L} style={{ gridColumn: c + 2, gridRow: 1 }} className="flex items-center justify-center font-mono text-[10px] text-muted-2">{L}</span>
      ))}
      {Array.from({ length: BOARD }, (_, r) => (
        <span key={`r${r}`} style={{ gridColumn: 1, gridRow: r + 2 }} className="flex items-center justify-center font-mono text-[10px] text-muted-2">{r + 1}</span>
      ))}
      {/* Water cells — also explicitly placed, so ship hulls (below) can overlap
          them as overlays instead of displacing them out of the grid. */}
      {Array.from({ length: CELLS }, (_, i) => {
        const r = Math.floor(i / BOARD);
        const c = i % BOARD;
        return (
          <button
            key={i}
            type="button"
            style={{ gridColumn: c + 2, gridRow: r + 2 }}
            onClick={onCell ? () => onCell(i) : undefined}
            onMouseEnter={onHover ? () => onHover(i) : undefined}
            className={`h-full w-full rounded-[3px] transition-colors ${cellClass(i)}`}
          />
        );
      })}
      {/* Ship hulls (z-10) and shot markers (z-20) — positioned over the cells. */}
      {ships.map((s, idx) => <ShipHull key={`s${idx}`} cells={s.cells} sunk={s.sunk} />)}
      {mark &&
        Array.from({ length: CELLS }, (_, i) => {
          const m = mark(i);
          if (!m) return null;
          return (
            <div key={`m${i}`} style={gridPos(i)} className="pointer-events-none relative z-20 flex items-center justify-center text-[15px] leading-none">
              {m}
            </div>
          );
        })}
    </div>
  );
}

/** Placement phase — drag-free: pick orientation, click to drop each ship. */
function Placement({ tableId, view }: { tableId: number; view: BattleshipView }) {
  const { place } = useBattleshipActions();
  const [ships, setShips] = useState<number[][]>([]);
  const [horizontal, setHorizontal] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset the local board whenever a fresh placing round starts (initial / rematch).
  useEffect(() => {
    if (!view.iPlaced) setShips([]);
  }, [view.iPlaced]);

  const used = useMemo(() => new Set(ships.flat()), [ships]);
  const nextSize = FLEET[ships.length];
  const preview = hover != null && nextSize != null ? shipCells(hover, nextSize, horizontal) : null;
  const previewValid = !!preview && !overlaps(preview, used);
  const previewSet = new Set(preview ?? []);

  function drop(i: number) {
    if (nextSize == null) return;
    const cells = shipCells(i, nextSize, horizontal);
    if (!cells || overlaps(cells, used)) { setError('Aí não cabe.'); return; }
    setError(null);
    setShips((s) => [...s, cells]);
  }

  async function submit() {
    setError(null);
    try {
      await place.mutateAsync({ tableId, ships });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falhou.');
    }
  }

  function cellClass(i: number) {
    if (previewSet.has(i)) return previewValid ? 'bg-positive/40 ring-1 ring-positive' : 'bg-negative/40 ring-1 ring-negative';
    return `${WATER} hover:bg-gold/15`;
  }
  const fleet = ships.map((cells) => ({ cells }));

  if (view.iPlaced) {
    return (
      <div className="space-y-3 text-center">
        <p className="font-display text-lg text-gold">Frota a postos.</p>
        <p className="font-sans text-sm text-muted">À espera que {view.oppName ?? 'o adversário'} posicione a frota…</p>
        <div className="flex justify-center">
          <OceanGrid cellClass={() => WATER} ships={view.myShips.map((cells) => ({ cells }))} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_240px] lg:items-start">
      <div className="flex justify-center">
        <OceanGrid cellClass={cellClass} ships={fleet} onCell={drop} onHover={setHover} onLeave={() => setHover(null)} />
      </div>
      <div className="card space-y-4 p-5">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Posiciona a frota</p>
          <p className="mt-1 font-sans text-sm text-muted">
            {nextSize != null ? `Coloca o navio de ${nextSize} casas.` : 'Frota completa — pronto a zarpar!'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FLEET.map((size, idx) => (
            <span
              key={idx}
              className={`rounded px-2 py-1 font-mono text-xs ${idx < ships.length ? 'bg-[#5a6b82]/40 text-text line-through' : idx === ships.length ? 'bg-gold/20 text-gold' : 'border border-border text-muted-2'}`}
            >
              {size}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setHorizontal((h) => !h)} className="flex-1">
            {horizontal ? '↔ Horizontal' : '↕ Vertical'}
          </Button>
          <Button variant="secondary" onClick={() => setShips(randomFleet())} className="flex-1">Aleatório</Button>
          <Button variant="secondary" onClick={() => setShips([])} className="flex-1">Limpar</Button>
        </div>
        <Button variant="primary" onClick={submit} disabled={ships.length !== FLEET.length || place.isPending} className="w-full">
          {place.isPending ? 'A enviar…' : 'Pronto'}
        </Button>
        {error && <p className="font-sans text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}

/** Battle phase — your fleet (incoming fire) + the enemy target grid, with a
 *  shared per-turn countdown. Both fleets are revealed once the game ends. */
function Battle({ tableId, view, serverNow }: { tableId: number; view: BattleshipView; serverNow?: string | undefined }) {
  const { fire, timeout } = useBattleshipActions();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [firing, setFiring] = useState<number | null>(null);

  const finished = view.phase === 'finished';
  const incoming = useMemo(() => new Set(view.incoming), [view.incoming]);
  const hitsOnMe = useMemo(() => new Set(view.myHits), [view.myHits]);
  const myHitCells = useMemo(() => new Set(view.myShots.filter((s) => s.hit).map((s) => s.cell)), [view.myShots]);
  const myMissCells = useMemo(() => new Set(view.myShots.filter((s) => !s.hit).map((s) => s.cell)), [view.myShots]);
  const firedCells = useMemo(() => new Set(view.myShots.map((s) => s.cell)), [view.myShots]);

  // Ship hull overlays. My whole fleet (sunk = every cell hit); the enemy's sunk
  // ships during play, then the full enemy fleet once revealed at the end.
  const myFleet = useMemo<ShipOverlay[]>(
    () => view.myShips.map((cells) => ({ cells, sunk: cells.every((x) => hitsOnMe.has(x)) })),
    [view.myShips, hitsOnMe],
  );
  const enemyFleet = useMemo<ShipOverlay[]>(() => {
    const src = finished ? view.enemyShips ?? [] : view.sunkEnemy;
    return src.map((cells) => ({ cells, sunk: cells.every((x) => myHitCells.has(x)) }));
  }, [finished, view.enemyShips, view.sunkEnemy, myHitCells]);

  // Sink notifications — compare ship-left counts across polls.
  const [flash, setFlash] = useState<string | null>(null);
  const prev = useRef<{ mine: number | null; enemy: number | null }>({ mine: null, enemy: null });
  useEffect(() => {
    const p = prev.current;
    if (p.enemy != null && view.enemyShipsLeft != null && view.enemyShipsLeft < p.enemy) setFlash('🚢 Afundaste um navio inimigo!');
    else if (p.mine != null && view.myShipsLeft != null && view.myShipsLeft < p.mine) setFlash('💥 Perderam-te um navio!');
    prev.current = { mine: view.myShipsLeft, enemy: view.enemyShipsLeft };
  }, [view.myShipsLeft, view.enemyShipsLeft]);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(id);
  }, [flash]);

  // Turn timer, corrected for clock skew using the server's `now` at fetch time.
  const offsetRef = useRef(0);
  useEffect(() => { if (serverNow) offsetRef.current = Date.now() - new Date(serverNow).getTime(); }, [serverNow]);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (view.phase !== 'playing') return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [view.phase]);
  const deadlineMs = view.turnDeadline ? new Date(view.turnDeadline).getTime() : null;
  const remainingMs = deadlineMs != null ? Math.max(0, deadlineMs - (Date.now() - offsetRef.current)) : null;
  const secs = remainingMs != null ? Math.ceil(remainingMs / 1000) : null;
  const pct = remainingMs != null ? Math.min(100, (remainingMs / TURN_MS) * 100) : 0;

  // When the clock hits zero, ask the server to auto-pass (either client may
  // trigger it; the server only acts if the deadline has truly elapsed).
  const timingOut = useRef(false);
  useEffect(() => {
    if (view.phase === 'playing' && view.turnDeadline && remainingMs === 0 && !timingOut.current) {
      timingOut.current = true;
      timeout
        .mutateAsync(tableId)
        .then((res) => qc.setQueryData(['battleship-table', tableId], res))
        .catch(() => {})
        .finally(() => { timingOut.current = false; });
    }
  }, [remainingMs, view.phase, view.turnDeadline, tableId, qc, timeout]);

  async function shoot(i: number) {
    if (!view.isMyTurn || finished || firedCells.has(i) || fire.isPending || firing != null) return;
    setError(null);
    setFiring(i); // optimistic crosshair while the server resolves the shot
    try {
      const res = await fire.mutateAsync({ tableId, cell: i });
      qc.setQueryData(['battleship-table', tableId], res); // instant board update
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disparo falhou.');
    } finally {
      setFiring(null);
    }
  }

  // A hit: a persistent charred crater + a one-shot fireball, shockwave, sparks
  // and a wisp of smoke (the one-shot layers play once when the mark first
  // mounts, then settle, so a hit cell ends up reading as a scorched mark).
  const blast = (
    <span className="relative inline-flex h-full w-full items-center justify-center" aria-hidden>
      <span
        className="absolute h-2.5 w-2.5 rounded-full"
        style={{ background: 'radial-gradient(circle,#ff7a2d 0%,#7a2a12 60%,#3a1408 100%)', boxShadow: '0 0 6px rgba(255,120,40,0.5)' }}
      />
      <span
        className="absolute h-5 w-5 rounded-full animate-hit-flash"
        style={{ background: 'radial-gradient(circle,#fff 0%,#ffd23d 32%,#ff6a00 68%,rgba(178,34,34,0) 100%)' }}
      />
      <span className="absolute h-4 w-4 rounded-full ring-2 ring-[#ffb066]/80 animate-splash" />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <span key={k} className="absolute" style={{ transform: `rotate(${k * 60}deg)` }}>
          <span className="block h-1 w-1 rounded-full bg-[#ffd270] animate-ember" style={{ animationDelay: `${k * 15}ms` }} />
        </span>
      ))}
      <span className="absolute bottom-1/2 h-2 w-2 rounded-full bg-[#3b3b3b]/70 animate-smoke" />
    </span>
  );
  // A miss: a small ripple + a persistent water dot.
  const splash = (
    <span className="relative inline-flex h-full w-full items-center justify-center" aria-hidden>
      <span className="absolute h-1.5 w-1.5 rounded-full bg-[#7fb0e0]/55" />
      <span className="absolute h-4 w-4 rounded-full border border-[#8aa0bd]/80 animate-splash" />
      <span className="absolute h-5 w-5 rounded-full border border-[#8aa0bd]/40 animate-splash" style={{ animationDelay: '90ms' }} />
    </span>
  );

  // My board: water everywhere (hulls are overlays); a 💥 marks their hits, ◦ their misses.
  const myCellClass = (i: number) => (incoming.has(i) && !hitsOnMe.has(i) ? 'bg-[#0a141f]/70 ring-1 ring-[#2b4a8b]/30' : WATER);
  function myMark(i: number) {
    if (hitsOnMe.has(i)) return blast;
    if (incoming.has(i)) return <span className="opacity-50">◦</span>;
    return null;
  }
  // Enemy board: water + crosshair on hover; my hits/misses marked on top.
  const enemyCellClass = (i: number) =>
    myMissCells.has(i)
      ? 'bg-[#0a141f]/70 ring-1 ring-[#2b4a8b]/30'
      : `${WATER} ${view.isMyTurn && !finished ? 'hover:bg-gold/20 cursor-crosshair' : ''}`;
  function enemyMark(i: number) {
    if (i === firing)
      return (
        <span className="absolute inset-0" aria-hidden>
          <span className="absolute inset-0 rounded-[3px] ring-2 ring-gold animate-ping" />
          <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/90" />
          <span className="absolute left-1/2 top-1/2 h-px w-5 -translate-x-1/2 -translate-y-1/2 bg-gold/80" />
          <span className="absolute left-1/2 top-1/2 h-5 w-px -translate-x-1/2 -translate-y-1/2 bg-gold/80" />
        </span>
      );
    if (myHitCells.has(i)) return blast;
    if (myMissCells.has(i)) return splash;
    return null;
  }

  return (
    <div className="space-y-5">
      {!finished && (
        <div className={`rounded-lg border px-4 py-2.5 ${view.isMyTurn ? 'border-gold/50 bg-gold/10' : 'border-border bg-surface-raised/50'}`}>
          <div className="flex items-center justify-between gap-3">
            <span className={`font-display text-base ${view.isMyTurn ? 'text-gold' : 'text-muted'}`}>
              {view.isMyTurn ? '🎯 É a tua vez — escolhe um alvo' : `Vez de ${view.oppName ?? 'o adversário'}…`}
            </span>
            {secs != null && <span className={`font-mono text-lg tabular-nums ${secs <= 5 ? 'text-negative' : 'text-text'}`}>{secs}s</span>}
          </div>
          {remainingMs != null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg/60">
              <div className={`h-full rounded-full transition-[width] duration-200 ${secs != null && secs <= 5 ? 'bg-negative' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}

      {flash && (
        <div className="animate-pop rounded-lg border border-gold/50 bg-gold/10 px-4 py-2 text-center font-display text-base text-gold">
          {flash}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2 text-center">
          <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted-2">A tua frota · {view.myShipsLeft ?? '—'} a salvo</p>
          <div className="flex justify-center"><OceanGrid cellClass={myCellClass} ships={myFleet} mark={myMark} /></div>
        </div>
        <div className="space-y-2 text-center">
          <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted-2">
            {finished ? 'Frota inimiga — revelada' : `Inimigo · ${view.enemyShipsLeft ?? '—'} por afundar`}
          </p>
          <div className="flex justify-center"><OceanGrid cellClass={enemyCellClass} ships={enemyFleet} mark={enemyMark} onCell={shoot} /></div>
        </div>
      </div>
      {error && <p className="text-center font-sans text-sm text-negative">{error}</p>}
    </div>
  );
}

/** Lobby — find a public opponent, open a private table, or join by code. */
function Lobby({ onEnter }: { onEnter: (tableId: number) => void }) {
  const { find, create, join } = useBattleshipActions();
  const [code, setCode] = useState('');
  const [created, setCreated] = useState<{ code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = find.isPending || create.isPending || join.isPending;

  async function run(fn: () => Promise<{ tableId?: number; code?: string }>, showCode = false) {
    setError(null);
    try {
      const res = await fn();
      if (showCode && res.code) setCreated({ code: res.code });
      if (res.tableId != null) onEnter(res.tableId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falhou.');
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button
        onClick={() => run(() => find.mutateAsync())}
        disabled={busy}
        className="card card-hover focus-ring group flex flex-col gap-2 p-6 text-left disabled:opacity-60"
      >
        <span className="text-2xl">⚓</span>
        <span className="font-display text-lg font-semibold text-text group-hover:text-gold">Encontrar oponente</span>
        <span className="font-sans text-[12.5px] text-muted">Entra na fila pública — emparelhamos-te com alguém à espera.</span>
      </button>

      <button
        onClick={() => run(() => create.mutateAsync(false), true)}
        disabled={busy}
        className="card card-hover focus-ring group flex flex-col gap-2 p-6 text-left disabled:opacity-60"
      >
        <span className="text-2xl">🔱</span>
        <span className="font-display text-lg font-semibold text-text group-hover:text-gold">Criar mesa privada</span>
        <span className="font-sans text-[12.5px] text-muted">Recebe um código e convida um amigo para a partida.</span>
      </button>

      {created && (
        <div className="card flex items-center justify-between gap-3 p-5 sm:col-span-2">
          <div>
            <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted-2">Código da mesa</p>
            <p className="font-mono text-2xl font-bold tracking-[0.3em] text-gold">{created.code}</p>
          </div>
          <p className="font-sans text-sm text-muted">Partilha-o — a partida começa quando o teu amigo entrar.</p>
        </div>
      )}

      <div className="card space-y-3 p-5 sm:col-span-2">
        <p className="font-sans text-sm font-medium text-muted">Entrar com um código</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={5}
            placeholder="ABCDE"
            className="focus-ring flex-1 rounded-md border border-border bg-surface px-4 py-2 font-mono text-lg uppercase tracking-[0.3em] text-text placeholder:text-muted-2/50"
          />
          <Button variant="primary" onClick={() => run(() => join.mutateAsync(code))} disabled={busy || code.length < 4}>
            Entrar
          </Button>
        </div>
      </div>

      {error && <p className="font-sans text-sm text-negative sm:col-span-2">{error}</p>}
    </div>
  );
}

export function BattleshipOnline() {
  const [tableId, setTableId] = useState<number | null>(null);
  const mine = useMyBattleship(tableId == null);
  const stateQ = useBattleshipState(tableId);
  const { rematch, leave } = useBattleshipActions();

  // Resume an in-progress game on load.
  useEffect(() => {
    if (tableId == null && mine.data?.tableId != null) setTableId(mine.data.tableId);
  }, [mine.data, tableId]);

  const res = stateQ.data;
  const view = res?.view ?? null;
  const inGame = tableId != null && view != null;

  const [celebrate, setCelebrate] = useState(0);
  useEffect(() => {
    if (view?.winner === 'me') setCelebrate((n) => n + 1);
  }, [view?.winner]);

  async function exit() {
    // Forfeit only an in-progress game; a finished one is already settled.
    if (tableId != null && view && view.phase !== 'finished') {
      try { await leave.mutateAsync(tableId); } catch { /* ignore */ }
    }
    setTableId(null);
  }

  return (
    <div className="animate-fade-in space-y-6">
      {view?.winner === 'me' && <WinCelebration key={celebrate} jackpot />}
      <div>
        <Link to="/" className="font-sans text-sm text-muted-2 hover:text-text">← Início</Link>
        <Eyebrow className="mt-3">1 contra 1 · online</Eyebrow>
        <h1 className="mt-2 font-display text-[34px] font-medium leading-tight text-text sm:text-[38px]">Batalha Naval</h1>
        <p className="mt-2 font-sans text-sm text-muted">
          Posiciona a tua frota e afunda a do adversário. Quem afundar primeiro toda a frota inimiga vence.
        </p>
      </div>

      {!inGame && <Lobby onEnter={setTableId} />}

      {inGame && view && (
        <div className="space-y-5">
          {/* Status strip */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-sans text-sm text-muted">
              <span className="font-medium text-text">{view.myName}</span>
              {' vs '}
              <span className="font-medium text-text">{view.oppName ?? '…'}</span>
            </p>
            {res?.code && !view.oppJoined && (
              <p className="font-mono text-sm text-gold">Código: <span className="tracking-[0.3em]">{res.code}</span></p>
            )}
            <button onClick={exit} className="font-sans text-sm text-muted-2 hover:text-negative">Sair</button>
          </div>

          {!view.oppJoined && view.phase !== 'finished' && (
            <div className="card p-6 text-center">
              <p className="animate-pulse font-display text-lg text-gold">À espera de um oponente…</p>
              {res?.code && <p className="mt-2 font-sans text-sm text-muted">Partilha o código <span className="font-mono text-gold">{res.code}</span> ou aguarda na fila pública.</p>}
            </div>
          )}

          {view.oppJoined && view.phase === 'placing' && <Placement tableId={tableId!} view={view} />}
          {(view.phase === 'playing' || view.phase === 'finished') && <Battle tableId={tableId!} view={view} serverNow={res?.serverNow} />}

          {view.phase === 'finished' && (
            <div className="card space-y-4 p-8 text-center">
              <p className={`font-display text-3xl font-bold ${view.winner === 'me' ? 'text-gold' : 'text-negative'}`}>
                {view.winner === 'me' ? '⚓ Venceste!' : 'A tua frota afundou.'}
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="primary" onClick={() => rematch.mutateAsync(tableId!)} disabled={rematch.isPending}>
                  Revanche
                </Button>
                <Button variant="secondary" onClick={exit}>Sair</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
