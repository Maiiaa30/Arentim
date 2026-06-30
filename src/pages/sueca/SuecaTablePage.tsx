import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PlayingCardFace, type CardSize } from '@/components/PlayingCardFace';
import { suitOf, cardLabel, legalMoves, SUIT_SYMBOLS } from '@/features/sueca/sueca';
import {
  useMySuecaTables,
  usePublicSuecaTables,
  useSuecaActions,
  useSuecaTableState,
  type SuecaSeatView,
  type SuecaTableView,
  type SuecaCallResult,
} from '@/features/sueca/useSuecaTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Eyebrow } from '@/components/ui/primitives';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Randomised pause between each replayed bot card, so they don't act at once. */
const botDelay = () => 480 + Math.random() * 1120;

const Card = ({ card, size = 'md' }: { card: number; size?: CardSize }) => (
  <PlayingCardFace rank={cardLabel(card)} suit={suitOf(card)} size={size} />
);

function Backs({ n }: { n: number }) {
  return (
    <div className="flex">
      {Array.from({ length: Math.min(n, 10) }).map((_, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? 0 : -28 }}>
          <PlayingCardFace faceDown size="sm" />
        </span>
      ))}
    </div>
  );
}

function SeatBadge({ s, turn }: { s: SuecaSeatView; turn?: number | undefined }) {
  const active = turn === s.seat;
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-sans text-[11px] font-medium ${active ? 'animate-glow border-gold bg-gold/15 text-gold' : 'border-border-strong bg-black/45 text-muted'}`}>
      {s.name}{s.isMe ? ' (você)' : ''}
    </span>
  );
}

export function SuecaTablePage() {
  const { data: myTables } = useMySuecaTables();
  const { data: publicTables } = usePublicSuecaTables();
  const { create, join, sit, seat, start, play, collect, ready, unready, timeout, leave } = useSuecaActions();
  const [tableId, setTableId] = useState<number | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [createPublic, setCreatePublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const collecting = useRef(false);
  const qc = useQueryClient();

  const { data } = useSuecaTableState(tableId);
  // While replaying a bot trail, `override` holds the frame being shown; else the
  // live polled state drives the board.
  const [override, setOverride] = useState<SuecaTableView | null>(null);
  const animating = useRef(false);
  const view = override ?? data?.view ?? null;

  /** Replay a response's bot trail one card at a time, then commit the final state. */
  async function applyResult(res: SuecaCallResult) {
    const trail = res.trail ?? [];
    if (trail.length > 1) {
      animating.current = true;
      for (const frame of trail) {
        setOverride(frame);
        await sleep(botDelay());
      }
    }
    animating.current = false;
    setOverride(null);
    if (tableId != null) qc.setQueryData(['sueca-table', tableId], res);
  }

  // Turn timer — clock-skew corrected from the server's `now`.
  const offsetRef = useRef(0);
  useEffect(() => { if (data?.serverNow) offsetRef.current = Date.now() - new Date(data.serverNow).getTime(); }, [data?.serverNow]);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (view?.status !== 'playing') return undefined;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [view?.status]);
  const deadlineMs = !animating.current && view?.turnDeadline ? new Date(view.turnDeadline).getTime() : null;
  const remainingMs = deadlineMs != null ? Math.max(0, deadlineMs - (Date.now() - offsetRef.current)) : null;
  const secs = remainingMs != null ? Math.ceil(remainingMs / 1000) : null;

  // Auto-play when the clock runs out (any client may trigger; the server only
  // acts if the deadline truly elapsed).
  const timingOut = useRef(false);
  useEffect(() => {
    if (view?.status === 'playing' && view.turnDeadline && remainingMs === 0 && !animating.current && !timingOut.current && tableId != null) {
      timingOut.current = true;
      timeout.mutateAsync(tableId).then(applyResult).catch(() => {}).finally(() => { timingOut.current = false; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, view?.status, view?.turnDeadline, tableId]);

  // Auto-resume only a table still in seat-selection ('open'). A leftover
  // 'playing' table must NOT hijack a fresh "Criar" — resume it explicitly from
  // the "As suas mesas" list instead. (This was the "creating a room enters
  // automatically without letting me choose" bug.)
  useEffect(() => {
    if (tableId != null || !myTables) return;
    const open = myTables.find((t) => t.status === 'open');
    if (open) setTableId(open.table_id);
  }, [myTables, tableId]);

  // When a trick is complete, pause to show it, then ask the server to collect.
  // Triggered off the committed state (not mid-animation override frames).
  useEffect(() => {
    const v = data?.view;
    if (v?.status === 'playing' && v.trickComplete && tableId != null && !collecting.current && !animating.current) {
      collecting.current = true;
      const t = window.setTimeout(() => {
        void collect.mutateAsync(tableId).then(applyResult).finally(() => { collecting.current = false; });
      }, 1400);
      return () => window.clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.view?.trickComplete, data?.view?.status, tableId]);

  const wrap = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Falhou.'); }
  };

  // ---- Lobby (not at a table) ----
  if (tableId == null || !view) {
    return (
      <div className="animate-fade-in space-y-8">
        <div>
          <Link to="/sueca" className="font-sans text-sm text-muted-2 hover:text-text">← Sueca</Link>
          <div className="mt-4">
            <Eyebrow>Com amigos</Eyebrow>
            <h1 className="mt-2 font-display text-[40px] font-medium leading-[1.04] text-text">Mesa de Sueca</h1>
            <p className="mt-3 font-sans text-[15px] text-muted">2 a 4 jogadores; os lugares vazios são preenchidos com bots. Os lugares frente a frente são parceiros.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-text">Criar uma mesa</h2>
            <label className="flex cursor-pointer items-center gap-2 font-sans text-sm text-muted">
              <input type="checkbox" checked={createPublic} onChange={(e) => setCreatePublic(e.target.checked)} className="h-4 w-4 accent-gold" />
              Pública (aparece na lista para qualquer um entrar)
            </label>
            <Button variant="primary" className="w-full" onClick={() => wrap(async () => { const r = await create.mutateAsync(createPublic); setTableId(r.view?.table_id ?? null); })}>Criar</Button>
          </div>
          <div className="card space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-text">Entrar com código</h2>
            <Input id="code" label="Código" placeholder="ABC12" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
            <Button variant="primary" className="w-full" disabled={joinCode.trim().length < 4} onClick={() => wrap(async () => { const r = await join.mutateAsync(joinCode.toUpperCase().trim()); setTableId(r.view?.table_id ?? null); })}>Entrar</Button>
          </div>
        </div>
        {publicTables && publicTables.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Mesas públicas</h2>
            {publicTables.map((t) => (
              <button key={t.table_id} onClick={() => wrap(async () => { const r = await sit.mutateAsync(t.table_id); setTableId(r.view?.table_id ?? null); })} className="card card-hover focus-ring flex w-full items-center justify-between p-3 text-left">
                <span className="font-sans text-sm text-text">Mesa de {t.host_name} · {t.players}/4</span>
                <span className="font-sans text-xs text-gold">Sentar</span>
              </button>
            ))}
          </div>
        )}
        {myTables && myTables.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">As suas mesas</h2>
            {myTables.map((t) => (
              <button key={t.table_id} onClick={() => setTableId(t.table_id)} className="card card-hover focus-ring flex w-full items-center justify-between p-3 text-left">
                <span className="font-sans text-sm text-text">Mesa {t.code} · {t.player_count} sentados</span>
                <span className="font-sans text-xs text-muted">{t.status}{t.is_host ? ' · anfitrião' : ''}</span>
              </button>
            ))}
          </div>
        )}
        {error && <p className="font-sans text-sm text-negative">{error}</p>}
      </div>
    );
  }

  const onLeave = () => wrap(async () => { await leave.mutateAsync(view.table_id); setTableId(null); });

  // ---- Seat selection room (open) ----
  if (view.status === 'open') {
    const TEAMS: { label: string; seats: number[]; tone: string }[] = [
      { label: 'Nós', seats: [0, 2], tone: 'text-positive' },
      { label: 'Eles', seats: [1, 3], tone: 'text-negative' },
    ];
    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] font-medium text-text sm:text-[32px]">Escolher lugares</h1>
            <p className="font-sans text-sm text-muted">Código: <span className="font-mono font-semibold text-gold">{view.code}</span> — partilhe para convidar.</p>
          </div>
          <Button variant="secondary" onClick={onLeave}>Sair</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {TEAMS.map((team) => (
            <div key={team.label} className="card space-y-3 p-5">
              <p className={`font-display text-sm font-bold uppercase tracking-[0.16em] ${team.tone}`}>{team.label}</p>
              {team.seats.map((sn) => {
                const s = view.seats[sn]!;
                return (
                  <div key={sn} className="flex items-center justify-between rounded border border-border bg-bg/50 px-3 py-2">
                    <span className="font-sans text-sm text-text">{s.present ? s.name + (s.isMe ? ' (você)' : '') : '— vazio —'}</span>
                    {!s.present && (
                      <Button variant="ghost" onClick={() => wrap(() => seat.mutateAsync({ tableId: view.table_id, seat: sn }))}>Sentar aqui</Button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {view.host ? (
            <Button variant="primary" onClick={() => wrap(async () => { const r = await start.mutateAsync(view.table_id); await applyResult(r); })}>Encher com bots e começar</Button>
          ) : (
            <p className="font-sans text-sm text-muted">À espera de o anfitrião começar…</p>
          )}
        </div>
        {error && <p className="font-sans text-sm text-negative">{error}</p>}
      </div>
    );
  }

  // ---- Playing ----
  const mySeat = view.mySeat;
  const dpos = (s: number) => (s - mySeat + 4) % 4; // 0 bottom(me) 1 right 2 top 3 left
  const seatAt = (d: number) => view.seats.find((s) => dpos(s.seat) === d)!;
  const trickAt = (d: number) => view.trick?.find((t) => dpos(t.seat) === d)?.card;
  const myTurn = view.turn === mySeat && !view.trickComplete && !view.done;
  const ledSuit = view.trick && view.trick.length ? suitOf(view.trick[0]!.card) : null;
  const myHand = [...(view.myHand ?? [])].sort((a, b) => suitOf(a) - suitOf(b) || (a % 10) - (b % 10));
  const legal = myTurn ? legalMoves(view.myHand ?? [], ledSuit) : [];
  // The trunfo belongs to the dealer (who kept it in hand) — show it by their seat.
  const trumpFor = (d: number) =>
    view.trumpCard != null && view.dealer != null && seatAt(d).seat === view.dealer ? (
      <span className="-mt-1 rotate-[-8deg] drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" title="Trunfo do baralhador">
        <Card card={view.trumpCard} size="sm" />
      </span>
    ) : null;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to="/sueca" className="font-sans text-sm text-muted-2 hover:text-text">← Sueca</Link>
          <h1 className="mt-1 font-display text-[26px] font-medium text-text sm:text-[30px]">Mesa {view.code}</h1>
        </div>
        <div className="flex items-center gap-3 text-right">
          <p className="font-mono text-sm text-text">
            <span className="text-positive">{view.capturedA}</span>–<span className="text-negative">{view.capturedB}</span>
            <span className="mx-1.5 text-muted-2">·</span>
            <span className="text-positive">{view.match[0]}</span>–<span className="text-negative">{view.match[1]}</span> jogos
          </p>
          <Button variant="secondary" onClick={onLeave}>Sair</Button>
        </div>
      </div>

      <div className="felt felt-rail relative mx-auto h-[540px] w-full max-w-4xl overflow-hidden rounded-[28px] p-4 sm:h-[580px]">
        {/* Trump indicator — label + the actual trunfo card, always visible
            top-left (it also sits with the dealer below). */}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-2">
          <span className="rounded-full border border-gold/40 bg-black/45 px-2.5 py-1 font-sans text-[11px] uppercase tracking-[0.16em] text-gold-light">
            Trunfo {view.trump != null ? SUIT_SYMBOLS[view.trump] : ''}
          </span>
          {view.trumpCard != null && (
            <span className="rotate-[-6deg] drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" title="Carta de trunfo">
              <Card card={view.trumpCard} size="sm" />
            </span>
          )}
        </div>

        {/* Seats — the dealer shows the trunfo card by their badge. */}
        <div className="absolute left-1/2 top-3 -translate-x-1/2 flex flex-col items-center gap-1.5"><SeatBadge s={seatAt(2)} turn={view.turn} />{trumpFor(2)}<Backs n={seatAt(2).cards} /></div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5"><SeatBadge s={seatAt(1)} turn={view.turn} />{trumpFor(1)}<Backs n={seatAt(1).cards} /></div>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5"><SeatBadge s={seatAt(3)} turn={view.turn} />{trumpFor(3)}<Backs n={seatAt(3).cards} /></div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2"><SeatBadge s={seatAt(0)} turn={view.turn} />{trumpFor(0)}</div>

        {/* Trick */}
        <div className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2">{trickAt(0) != null && <Card card={trickAt(0)!} size="lg" />}</div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2">{trickAt(1) != null && <Card card={trickAt(1)!} size="lg" />}</div>
          <div className="absolute left-1/2 top-0 -translate-x-1/2">{trickAt(2) != null && <Card card={trickAt(2)!} size="lg" />}</div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2">{trickAt(3) != null && <Card card={trickAt(3)!} size="lg" />}</div>
        </div>

        {/* Result + ready-up for the next hand */}
        {view.done && view.result && (() => {
          const flags = view.readyNext ?? [];
          const iAmReady = !!flags[mySeat];
          const waitingFor = view.seats.filter((s) => s.present && !s.bot && !flags[s.seat]).map((s) => s.name);
          return (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gold bg-bg/90 px-6 py-4 text-center shadow-[0_12px_50px_rgba(0,0,0,0.6)]">
              <p className="font-display text-2xl font-bold text-gold">
                {view.result.winner === null ? 'Empate' : teamOfSeat(view.result.winner, mySeat) ? 'Ganhámos!' : 'Perdemos.'}
              </p>
              <p className="mt-1 font-sans text-sm text-muted">{view.result.teamAPoints}–{view.result.teamBPoints}{view.result.margin !== 'normal' && ` · ${view.result.margin === 'capote' ? 'Capote!' : 'Dupla'}`}</p>
              <div className="mt-3 flex flex-col items-center gap-2">
                {!iAmReady ? (
                  <Button variant="primary" onClick={() => wrap(async () => { const r = await ready.mutateAsync(view.table_id); await applyResult(r); })}>Pronto para a próxima</Button>
                ) : (
                  <>
                    <p className="font-sans text-sm text-muted">
                      {waitingFor.length ? `À espera de ${waitingFor.join(', ')}…` : 'A começar…'}
                    </p>
                    <Button variant="secondary" onClick={() => wrap(async () => { const r = await unready.mutateAsync(view.table_id); await applyResult(r); })}>Cancelar</Button>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* My hand */}
      <div className="mx-auto max-w-4xl">
        <p className="mb-2 flex items-center justify-center gap-2 text-center font-sans text-[11px] uppercase tracking-[0.2em] text-muted-2">
          <span>{myTurn ? 'A sua vez' : view.done ? 'Mão terminada' : `Vez de ${seatAt(dpos(view.turn ?? 0)).name}`}</span>
          {secs != null && !view.done && (
            <span className={`font-mono text-xs ${secs <= 5 ? 'text-negative' : 'text-gold'}`}>{secs}s</span>
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {myHand.map((card) => {
            const ok = legal.includes(card);
            return (
              <button key={card} disabled={!myTurn || !ok}
                onClick={() => wrap(async () => {
                  // Apply the returned state immediately so your own card lands
                  // without waiting for the next poll.
                  const r = await play.mutateAsync({ tableId: view.table_id, card });
                  await applyResult(r);
                })}
                className={`focus-ring rounded-md transition-transform ${myTurn && ok ? 'cursor-pointer hover:-translate-y-2' : 'cursor-not-allowed opacity-45'}`}>
                <Card card={card} size="lg" />
              </button>
            );
          })}
        </div>
        {error && <p className="mt-2 text-center font-sans text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}

/** Is the winning team (0=seats 0&2, 1=seats 1&3) the viewer's team? */
function teamOfSeat(winningTeam: 0 | 1, mySeat: number): boolean {
  return mySeat % 2 === winningTeam;
}
