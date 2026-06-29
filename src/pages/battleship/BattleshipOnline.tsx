import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  type BattleshipView,
} from '@/features/battleship/board';

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
      className="inline-grid w-full max-w-[360px] select-none gap-[2px] rounded-lg p-2"
      style={{ gridTemplateColumns: `0.9rem repeat(${BOARD}, 1fr)`, background: 'linear-gradient(160deg,#0c1320,#0a0f18 60%,#070b12)' }}
      onMouseLeave={onLeave}
    >
      <span />
      {COLS.map((L) => (
        <span key={L} className="text-center font-mono text-[9px] leading-4 text-muted-2">{L}</span>
      ))}
      {Array.from({ length: BOARD }, (_, r) => (
        <Fragment key={r}>
          <span className="flex items-center justify-center font-mono text-[9px] text-muted-2">{r + 1}</span>
          {Array.from({ length: BOARD }, (_, c) => {
            const i = r * BOARD + c;
            return (
              <button
                key={i}
                type="button"
                onClick={onCell ? () => onCell(i) : undefined}
                onMouseEnter={onHover ? () => onHover(i) : undefined}
                className={`flex aspect-square items-center justify-center rounded-[3px] text-[11px] leading-none transition-colors ${cellClass(i)}`}
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
    if (used.has(i)) return 'bg-[#5a6b82] ring-1 ring-[#8aa0bd]';
    if (previewSet.has(i)) return previewValid ? 'bg-positive/40 ring-1 ring-positive' : 'bg-negative/40 ring-1 ring-negative';
    return 'bg-[#0f1c2e] ring-1 ring-[#2b4a8b]/35 hover:bg-gold/15';
  }

  if (view.iPlaced) {
    return (
      <div className="space-y-3 text-center">
        <p className="font-display text-lg text-gold">Frota a postos.</p>
        <p className="font-sans text-sm text-muted">À espera que {view.oppName ?? 'o adversário'} posicione a frota…</p>
        <div className="flex justify-center">
          <OceanGrid cellClass={(i) => (new Set(view.myShips.flat()).has(i) ? 'bg-[#5a6b82] ring-1 ring-[#8aa0bd]' : 'bg-[#0f1c2e] ring-1 ring-[#2b4a8b]/30')} />
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

/** Battle phase — your fleet (incoming fire) + the enemy target grid. */
function Battle({ tableId, view }: { tableId: number; view: BattleshipView }) {
  const { fire } = useBattleshipActions();
  const [error, setError] = useState<string | null>(null);

  const myShipCells = useMemo(() => new Set(view.myShips.flat()), [view.myShips]);
  const incoming = useMemo(() => new Set(view.incoming), [view.incoming]);
  const hitsOnMe = useMemo(() => new Set(view.myHits), [view.myHits]);
  const myHitCells = useMemo(() => new Set(view.myShots.filter((s) => s.hit).map((s) => s.cell)), [view.myShots]);
  const myMissCells = useMemo(() => new Set(view.myShots.filter((s) => !s.hit).map((s) => s.cell)), [view.myShots]);
  const firedCells = useMemo(() => new Set(view.myShots.map((s) => s.cell)), [view.myShots]);
  const sunkEnemy = useMemo(() => new Set(view.sunkEnemy.flat()), [view.sunkEnemy]);

  async function shoot(i: number) {
    if (!view.isMyTurn || firedCells.has(i) || fire.isPending) return;
    setError(null);
    try {
      await fire.mutateAsync({ tableId, cell: i });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disparo falhou.');
    }
  }

  function myCell(i: number) {
    if (hitsOnMe.has(i)) return 'bg-negative/40 ring-1 ring-negative';
    if (incoming.has(i)) return 'bg-[#13233a] ring-1 ring-[#2b4a8b]/40';
    if (myShipCells.has(i)) return 'bg-[#5a6b82] ring-1 ring-[#8aa0bd]';
    return 'bg-[#0f1c2e] ring-1 ring-[#2b4a8b]/30';
  }
  function myContent(i: number) {
    if (hitsOnMe.has(i)) return '💥';
    if (incoming.has(i)) return <span className="opacity-50">◦</span>;
    return null;
  }
  function enemyCell(i: number) {
    if (sunkEnemy.has(i)) return 'bg-negative/30 ring-1 ring-negative/60';
    if (myHitCells.has(i)) return 'bg-gold/25 ring-1 ring-gold/60';
    if (myMissCells.has(i)) return 'bg-[#0c1622] ring-1 ring-[#2b4a8b]/30';
    return `bg-[#0f1c2e] ring-1 ring-[#2b4a8b]/35 ${view.isMyTurn ? 'hover:bg-gold/20 cursor-crosshair' : ''}`;
  }
  function enemyContent(i: number) {
    if (sunkEnemy.has(i)) return '🚢';
    if (myHitCells.has(i)) return '💥';
    if (myMissCells.has(i)) return <span className="opacity-50">◦</span>;
    return null;
  }

  return (
    <div className="space-y-5">
      <div
        className={`rounded-lg border px-4 py-2.5 text-center font-display text-base ${
          view.isMyTurn ? 'border-gold/50 bg-gold/10 text-gold' : 'border-border bg-surface-raised/50 text-muted'
        }`}
      >
        {view.isMyTurn ? '🎯 É a tua vez — escolhe um alvo' : `À espera de ${view.oppName ?? 'o adversário'}…`}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2 text-center">
          <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted-2">A tua frota · {view.myShipsLeft ?? '—'} a salvo</p>
          <div className="flex justify-center"><OceanGrid cellClass={myCell} cellContent={myContent} /></div>
        </div>
        <div className="space-y-2 text-center">
          <p className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted-2">Inimigo · {view.enemyShipsLeft ?? '—'} por afundar</p>
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
          {view.phase === 'playing' && <Battle tableId={tableId!} view={view} />}

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
