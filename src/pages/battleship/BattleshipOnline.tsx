import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  COLS,
  FLEET,
  shipCells,
  overlaps,
  randomFleet,
  shipSegments,
  type BattleshipView,
} from '@/features/battleship/board';

const TURN_MS = 30_000;
// Metallic hull fill — combined with a per-cell rounded class so a run of cells
// reads as one ship rather than separate squares.
const SHIP_BG = 'bg-[linear-gradient(150deg,#aebfd6,#46566e_55%,#2c3850)] ring-1 ring-[#c2d2e8]/40 shadow-[inset_0_-2px_3px_rgba(0,0,0,0.45)]';

/** A 10×10 ocean grid with A–J / 1–10 coordinates. */
function OceanGrid({
  cellClass,
  cellContent,
  onCell,
  onHover,
  onLeave,
}: {
  cellClass: (i: number) => string;
  cellContent?: (i: number) => ReactNode;
  onCell?: (i: number) => void;
  onHover?: (i: number) => void;
  onLeave?: () => void;
}) {
  return (
    <div
      className="inline-grid w-full max-w-[480px] select-none gap-[3px] rounded-lg p-2.5 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)] ring-1 ring-[#2b4a8b]/30"
      style={{
        gridTemplateColumns: `1.1rem repeat(${BOARD}, 1fr)`,
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(160,190,220,0.035) 0 1px, transparent 1px 16px),' +
          'radial-gradient(130% 80% at 50% -10%, rgba(43,74,139,0.30), transparent 60%),' +
          'linear-gradient(160deg,#0e1d33,#0a1422 55%,#070d18)',
      }}
      onMouseLeave={onLeave}
    >
      <span />
      {COLS.map((L) => (
        <span key={L} className="text-center font-mono text-[10px] leading-4 text-muted-2">{L}</span>
      ))}
      {Array.from({ length: BOARD }, (_, r) => (
        <Fragment key={r}>
          <span className="flex items-center justify-center font-mono text-[10px] text-muted-2">{r + 1}</span>
          {Array.from({ length: BOARD }, (_, c) => {
            const i = r * BOARD + c;
            return (
              <button
                key={i}
                type="button"
                onClick={onCell ? () => onCell(i) : undefined}
                onMouseEnter={onHover ? () => onHover(i) : undefined}
                className={`relative flex aspect-square items-center justify-center rounded-[3px] text-[15px] leading-none transition-colors ${cellClass(i)}`}
              >
                {cellContent?.(i)}
              </button>
            );
          })}
        </Fragment>
      ))}
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
  const seg = useMemo(() => shipSegments(ships), [ships]);
  const myFleetSeg = useMemo(() => shipSegments(view.myShips), [view.myShips]);
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
    if (used.has(i)) return `${SHIP_BG} ${seg.get(i) ?? ''}`;
    if (previewSet.has(i)) return previewValid ? 'bg-positive/40 ring-1 ring-positive' : 'bg-negative/40 ring-1 ring-negative';
    return 'bg-[#0f1c2e] ring-1 ring-[#2b4a8b]/35 hover:bg-gold/15';
  }

  if (view.iPlaced) {
    return (
      <div className="space-y-3 text-center">
        <p className="font-display text-lg text-gold">Frota a postos.</p>
        <p className="font-sans text-sm text-muted">À espera que {view.oppName ?? 'o adversário'} posicione a frota…</p>
        <div className="flex justify-center">
          <OceanGrid cellClass={(i) => (myFleetSeg.get(i) !== undefined ? `${SHIP_BG} ${myFleetSeg.get(i)}` : 'bg-[#0f1c2e] ring-1 ring-[#2b4a8b]/30')} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_240px] lg:items-start">
      <div className="flex justify-center">
        <OceanGrid cellClass={cellClass} onCell={drop} onHover={setHover} onLeave={() => setHover(null)} />
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
  const myShipSeg = useMemo(() => shipSegments(view.myShips), [view.myShips]);
  const enemyShipSeg = useMemo(() => shipSegments(view.enemyShips ?? []), [view.enemyShips]);
  const incoming = useMemo(() => new Set(view.incoming), [view.incoming]);
  const hitsOnMe = useMemo(() => new Set(view.myHits), [view.myHits]);
  const myHitCells = useMemo(() => new Set(view.myShots.filter((s) => s.hit).map((s) => s.cell)), [view.myShots]);
  const myMissCells = useMemo(() => new Set(view.myShots.filter((s) => !s.hit).map((s) => s.cell)), [view.myShots]);
  const firedCells = useMemo(() => new Set(view.myShots.map((s) => s.cell)), [view.myShots]);
  const sunkEnemy = useMemo(() => new Set(view.sunkEnemy.flat()), [view.sunkEnemy]);

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

  const blast = (
    <>
      <span className="absolute inset-0 rounded-[3px] bg-negative/55 animate-splash" aria-hidden />
      <span className="relative animate-explode">💥</span>
    </>
  );
  const splash = (
    <>
      <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#8aa0bd]/80 animate-splash" aria-hidden />
      <span className="relative opacity-50">◦</span>
    </>
  );

  function myCell(i: number) {
    const seg = myShipSeg.get(i);
    if (seg !== undefined) return `${SHIP_BG} ${seg} ${hitsOnMe.has(i) ? 'brightness-[0.7] ring-negative' : ''}`;
    if (incoming.has(i)) return 'bg-[#13233a] ring-1 ring-[#2b4a8b]/40';
    return 'bg-[#0f1c2e] ring-1 ring-[#2b4a8b]/30';
  }
  function myContent(i: number) {
    if (hitsOnMe.has(i)) return blast;
    if (incoming.has(i)) return <span className="opacity-50">◦</span>;
    return null;
  }
  function enemyCell(i: number) {
    // Enemy ship cells: only sunk ones show during play; the whole fleet at the end.
    const seg = finished ? enemyShipSeg.get(i) : sunkEnemy.has(i) ? 'rounded-[3px]' : undefined;
    if (seg !== undefined) {
      const hit = myHitCells.has(i) || sunkEnemy.has(i);
      return `${SHIP_BG} ${seg} ${hit ? 'brightness-[0.7] ring-negative' : 'opacity-80'}`;
    }
    if (myHitCells.has(i)) return 'bg-gold/25 ring-1 ring-gold/60';
    if (myMissCells.has(i)) return 'bg-[#0c1622] ring-1 ring-[#2b4a8b]/30';
    return `bg-[#0f1c2e] ring-1 ring-[#2b4a8b]/35 ${view.isMyTurn && !finished ? 'hover:bg-gold/20 cursor-crosshair' : ''}`;
  }
  function enemyContent(i: number) {
    if (i === firing) return <span className="absolute inset-0 rounded-[3px] ring-2 ring-gold animate-ping" aria-hidden />;
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

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2 text-center">
          <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted-2">A tua frota · {view.myShipsLeft ?? '—'} a salvo</p>
          <div className="flex justify-center"><OceanGrid cellClass={myCell} cellContent={myContent} /></div>
        </div>
        <div className="space-y-2 text-center">
          <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted-2">
            {finished ? 'Frota inimiga — revelada' : `Inimigo · ${view.enemyShipsLeft ?? '—'} por afundar`}
          </p>
          <div className="flex justify-center"><OceanGrid cellClass={enemyCell} cellContent={enemyContent} onCell={shoot} /></div>
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
