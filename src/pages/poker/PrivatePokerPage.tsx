import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/useProfile';
import {
  useMyPokerTables,
  usePokerTableActions,
  usePokerTableState,
} from '@/features/poker/usePokerTable';
import { PokerTable, ResultBanner } from '@/features/poker/PokerTable';
import { PokerActionBar } from '@/features/poker/PokerActionBar';
import { TurnTimer } from '@/features/poker/TurnTimer';
import type { PokerView } from '@/features/poker/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Eyebrow } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';

const STATUS_LABEL: Record<string, string> = {
  active: 'ativo',
  folded: 'desistiu',
  allin: 'all-in',
  out: 'fora',
  waiting: 'à espera',
  open: 'aberta',
  playing: 'a jogar',
  done: 'terminada',
};

const DIFFICULTY_LABEL: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
};

const BUYIN_PRESETS = [100, 200, 500, 1000, 2500];
/** A private table seats 9; minus your own seat that's up to 8 bots. */
const MAX_BOTS = 8;
/** Random pause between each bot's replayed move, so they don't all act at once. */
const botDelay = () => 480 + Math.random() * 1120;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PrivatePokerPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: myTables } = useMyPokerTables();
  const { create, join, addBot, start, deal, act, leave, rebuy } = usePokerTableActions();
  const qc = useQueryClient();

  const [tableId, setTableId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [buyIn, setBuyIn] = useState(200);
  const [botCount, setBotCount] = useState(MAX_BOTS); // default: a full table
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [raiseTo, setRaiseTo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // While a trail is replaying we show these snapshots instead of the polled state.
  const [replayView, setReplayView] = useState<PokerView | null>(null);
  const [animating, setAnimating] = useState(false);

  const { data: state } = usePokerTableState(tableId);
  const polledView = state?.view ?? null;
  const view = replayView ?? polledView;
  const isHost = state?.host ?? false;
  const balance = profile?.balance ?? 0;
  const busy = create.isPending || join.isPending || act.isPending || start.isPending || deal.isPending || addBot.isPending || leave.isPending || rebuy.isPending || animating;

  // If already seated somewhere, auto-select it.
  useEffect(() => {
    if (tableId == null && myTables && myTables.length > 0) setTableId(myTables[0]!.table_id);
  }, [myTables, tableId]);

  const wrap = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'A ação falhou.'); }
  };

  // Run a table action, then replay its bot-action trail one move at a time so
  // the bots don't all bet instantly. The final view is patched into the polled
  // cache before we drop the overlay, so the board never flashes a stale state.
  const runWithTrail = (fn: () => Promise<{ view: PokerView | null; trail?: PokerView[]; turnDeadline?: string | null }>) =>
    wrap(async () => {
      const res = await fn();
      const trail = res.trail ?? [];
      const commit = (final: PokerView | null) => {
        if (tableId != null && final) {
          qc.setQueryData(['poker-table', tableId], (old: unknown) => ({
            ...(old as object), view: final, turnDeadline: res.turnDeadline ?? null,
          }));
        }
      };
      if (trail.length <= 1) { commit(res.view); return; }
      setAnimating(true);
      try {
        for (const step of trail) {
          setReplayView(step);
          await sleep(botDelay());
        }
        if (res.view) setReplayView(res.view);
        commit(res.view);
      } finally {
        setAnimating(false);
        setReplayView(null);
      }
    });

  async function onCreate() {
    if (buyIn > balance) return setError('Saldo insuficiente.');
    await wrap(async () => {
      const res = await create.mutateAsync({ buyIn, botCount, difficulty });
      setTableId(res.table_id ?? null);
      setCode(res.code ?? '');
    });
  }
  async function onJoin() {
    await wrap(async () => {
      const res = await join.mutateAsync(joinCode.toUpperCase().trim());
      setTableId(res.table_id ?? null);
    });
  }
  async function onRebuy(amount: number) {
    if (tableId == null) return;
    await wrap(() => rebuy.mutateAsync({ tableId, amount }));
  }
  async function onLeave() {
    if (tableId == null) return;
    const leftId = tableId;
    await wrap(async () => {
      await leave.mutateAsync(leftId);
      // Drop the table from the seated list immediately so the "auto-select if
      // already seated" effect below doesn't re-enter the table we just left
      // (the list refetch lags behind, so without this you get pulled back in).
      qc.setQueryData(
        ['poker-tables', user?.id],
        (old: { table_id: number }[] | undefined) => old?.filter((t) => t.table_id !== leftId) ?? [],
      );
      setTableId(null);
      setCode('');
      setReplayView(null);
    });
  }

  // ---- Lobby ----
  if (tableId == null || !view) {
    return (
      <div className="animate-fade-in space-y-8">
        <div>
          <Link to="/poker" className="font-sans text-sm text-muted-2 hover:text-text">← Poker</Link>
          <div className="mt-4">
            <Eyebrow>Só para convidados</Eyebrow>
            <h1 className="mt-2 font-display text-[40px] font-medium leading-[1.04] text-text">Mesa privada</h1>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-5 p-6">
            <h2 className="font-display text-lg font-semibold text-text">Criar uma mesa</h2>

            <div>
              <label htmlFor="buyin" className="mb-1.5 block font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">
                Entrada (fichas para a mesa)
              </label>
              <Input id="buyin" type="number" min={100} value={buyIn}
                onChange={(e) => setBuyIn(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
              <div className="mt-2 flex flex-wrap gap-2">
                {BUYIN_PRESETS.map((amt) => (
                  <button key={amt} type="button" onClick={() => setBuyIn(amt)} disabled={amt > balance}
                    className={`focus-ring rounded-full border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-30 ${
                      buyIn === amt ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted hover:text-text'
                    }`}>
                    {formatAmount(amt)}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 font-sans text-[11px] text-muted-2">Saldo: {formatAmount(balance)} Tostões</p>
            </div>

            <div>
              <label className="mb-1.5 block font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">
                Bots para encher a mesa
              </label>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: MAX_BOTS }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" onClick={() => setBotCount(n)}
                    className={`focus-ring min-h-[40px] w-10 rounded border font-mono text-sm transition-colors ${
                      botCount === n ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted hover:text-text'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 font-sans text-[11px] text-muted-2">
                {botCount} bot{botCount === 1 ? '' : 's'} + você = mesa de {botCount + 1}.{' '}
                {botCount >= MAX_BOTS ? 'Mesa cheia — reduza os bots para deixar lugares a amigos.' : 'Os amigos entram nos lugares livres.'}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">Dificuldade dos bots</label>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <button key={d} type="button" onClick={() => setDifficulty(d)}
                    className={`focus-ring min-h-[40px] flex-1 rounded border py-2 font-sans text-sm transition-colors ${
                      difficulty === d ? 'border-gold bg-gold/10 text-gold' : 'border-border text-muted hover:text-text'
                    }`}>
                    {DIFFICULTY_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>

            <Button variant="primary" onClick={onCreate} disabled={busy || buyIn > balance || buyIn < 100} className="w-full">
              {create.isPending ? 'A criar…' : `Criar mesa · ${formatAmount(buyIn)}`}
            </Button>
          </div>

          <div className="card h-fit space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-text">Entrar com um código</h2>
            <Input id="code" label="Código da mesa" placeholder="ABC123" value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)} />
            <Button variant="primary" onClick={onJoin} disabled={busy || joinCode.trim().length < 4} className="w-full">Entrar</Button>
          </div>
        </div>
        {myTables && myTables.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-sans text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-2">As suas mesas</h2>
            {myTables.map((t) => (
              <button key={t.table_id} onClick={() => setTableId(t.table_id)}
                className="card card-hover focus-ring flex w-full items-center justify-between p-3 text-left">
                <span className="font-sans text-sm text-text">Mesa {t.code} · {t.player_count} sentados</span>
                <span className="font-sans text-xs text-muted">{STATUS_LABEL[t.status] ?? t.status}{t.is_host ? ' · anfitrião' : ''}</span>
              </button>
            ))}
          </div>
        )}
        {error && <p className="font-sans text-sm text-negative">{error}</p>}
      </div>
    );
  }

  // ---- Table ----
  const me = view.players.find((p) => p.id === user?.id);
  const myTurn = view.toActId === user?.id && !view.handOver;
  const owe = view.currentBet - (me?.committed ?? 0);
  const allInTo = (me?.stack ?? 0) + (me?.committed ?? 0);
  const minRaiseTo = Math.min(view.currentBet + view.minRaise, allInTo);
  const maxRaiseTo = allInTo;
  const effRaiseTo = Math.max(minRaiseTo, Math.min(raiseTo || minRaiseTo, maxRaiseTo));
  const canRaise = allInTo > view.currentBet && !!myTurn;
  // Show the bet clock only on the live (non-replay) state, when it's our turn.
  const turnDeadline = !replayView && myTurn ? state?.turnDeadline ?? null : null;
  const quickBets = canRaise
    ? (() => {
        const clamp = (n: number) => Math.max(minRaiseTo, Math.min(n, maxRaiseTo));
        const raw = [
          { label: 'Mín', to: minRaiseTo },
          { label: '½ Pote', to: clamp(view.currentBet + Math.round(view.pot * 0.5)) },
          { label: 'Pote', to: clamp(view.currentBet + view.pot) },
          { label: 'All-in', to: maxRaiseTo },
        ];
        const seen = new Set<number>();
        return raw.filter((q) => (seen.has(q.to) ? false : (seen.add(q.to), true)));
      })()
    : [];
  const inLobby = view.street === 'idle';

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-text sm:text-[32px]">Mesa privada</h1>
          {code && <p className="font-sans text-sm text-muted">Código da mesa: <span className="font-mono font-semibold text-gold">{code}</span></p>}
        </div>
        <Button variant="secondary" onClick={onLeave} disabled={busy}>
          {leave.isPending ? 'A sair…' : `Sair · ${formatAmount(me?.stack ?? 0)} tós`}
        </Button>
      </div>

      <PokerTable
        view={view}
        youId={user?.id ?? '__me__'}
        myTurn={!!myTurn}
        resultBanner={<ResultBanner view={view} />}
      />

      {/* Out of chips — rebuy from your Tostões balance (between hands only) */}
      {me && me.stack === 0 && view.handOver && (
        <div className="card space-y-3 border-gold/40 bg-gold/[0.06] p-4 text-center">
          <p className="font-display text-base font-medium text-text">Ficaste sem fichas</p>
          <p className="font-sans text-sm text-muted">Recarrega para continuar — sai do teu saldo de Tostões.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {BUYIN_PRESETS.map((amt) => (
              <button
                key={amt}
                type="button"
                disabled={busy || amt > balance}
                onClick={() => onRebuy(amt)}
                className="focus-ring rounded-full border border-gold/40 px-4 py-2 font-mono text-sm text-gold transition-colors hover:bg-gold hover:text-bg disabled:opacity-30"
              >
                +{formatAmount(amt)}
              </button>
            ))}
          </div>
          <p className="font-sans text-[11px] text-muted-2">Saldo: {formatAmount(balance)} tós</p>
        </div>
      )}

      {/* Controls */}
      <div className="card space-y-3 p-4">
        {inLobby ? (
          <div className="flex flex-wrap justify-center gap-2">
            {isHost && <Button variant="secondary" onClick={() => wrap(() => addBot.mutateAsync({ tableId, difficulty }))} disabled={busy || view.players.length >= 9}>Adicionar bot</Button>}
            {isHost && <Button variant="primary" onClick={() => runWithTrail(() => start.mutateAsync(tableId))} disabled={busy || view.players.length < 2}>Iniciar mão</Button>}
            {!isHost && <p className="font-sans text-sm text-muted">À espera de o anfitrião iniciar…</p>}
          </div>
        ) : myTurn ? (
          <div className="space-y-3">
            {turnDeadline && <TurnTimer deadline={turnDeadline} />}
            <PokerActionBar
              owe={owe}
              callAmount={Math.min(owe, me?.stack ?? 0)}
              raiseTo={effRaiseTo}
              minRaiseTo={minRaiseTo}
              maxRaiseTo={maxRaiseTo}
              canRaise={canRaise}
              busy={busy}
              quickBets={quickBets}
              onFold={() => runWithTrail(() => act.mutateAsync({ tableId, action: 'fold', raiseTo: 0 }))}
              onCheck={() => runWithTrail(() => act.mutateAsync({ tableId, action: 'check', raiseTo: 0 }))}
              onCall={() => runWithTrail(() => act.mutateAsync({ tableId, action: 'call', raiseTo: 0 }))}
              onRaise={() => runWithTrail(() => act.mutateAsync({ tableId, action: 'raise', raiseTo: effRaiseTo }))}
              onRaiseChange={setRaiseTo}
            />
          </div>
        ) : view.handOver ? (
          <div className="flex justify-center gap-2">
            {isHost ? <Button variant="primary" onClick={() => runWithTrail(() => deal.mutateAsync(tableId))} disabled={busy}>Próxima mão</Button>
              : <p className="font-sans text-sm text-muted">Mão terminada — à espera do anfitrião.</p>}
          </div>
        ) : (
          <p className="text-center font-sans text-sm text-muted">À espera de {view.players.find((p) => p.id === view.toActId)?.name ?? 'outros'}…</p>
        )}
        {error && <p className="text-center font-sans text-sm text-negative">{error}</p>}
      </div>

      {view.log.length > 0 && <p className="text-center font-sans text-xs text-muted">{view.log.join(' · ')}</p>}
    </div>
  );
}
