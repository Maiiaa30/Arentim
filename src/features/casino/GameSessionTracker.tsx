import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { formatAmount } from '@/lib/format';
import { matchGame, type GameMeta } from './gameRoutes';
import type { GameSessionStats } from '@/types/db';

type EndedSession = GameMeta & { startedAt: string };

/** The summary popup itself — fetches the session totals and shows them. */
function GameExitSummary({ session, onClose }: { session: EndedSession; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['game-session', session.label, session.startedAt] as const,
    staleTime: Infinity,
    gcTime: 60_000,
    queryFn: async (): Promise<GameSessionStats> => {
      const { data, error } = await supabase.rpc('game_session_stats', {
        p_games: session.keys,
        p_since: session.startedAt,
      });
      if (error) throw error;
      return data;
    },
  });

  // Nothing wagered (just looked around) or the call failed → don't interrupt.
  useEffect(() => {
    if (isError || (data && data.plays === 0)) onClose();
  }, [data, isError, onClose]);

  if (isLoading || isError || !data || data.plays === 0) return null;

  const net = data.won - data.wagered;
  const up = net >= 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-session-title"
    >
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Fechar" onClick={onClose} />
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-lg border border-gold/40 p-6 shadow-2xl"
        style={{ background: 'linear-gradient(150deg,#16120b 0%,#0d0b07 60%,#0c0f0c 100%)' }}
      >
        <span className="absolute left-4 top-4 h-5 w-5 border-l border-t border-gold/60" aria-hidden />
        <span className="absolute bottom-4 right-4 h-5 w-5 border-b border-r border-gold/60" aria-hidden />

        <p className="text-center font-sans text-[10.5px] font-medium uppercase tracking-[0.22em] text-gold">
          Resumo da sessão
        </p>
        <h2 id="game-session-title" className="mt-1 text-center font-display text-2xl font-medium text-text">
          {session.label}
        </h2>

        {/* Headline result */}
        <div className="mt-5 rounded border border-gold/30 bg-bg/40 px-4 py-4 text-center">
          <p className="font-sans text-[11px] uppercase tracking-wide text-muted-2">Resultado</p>
          <p className={`mt-1 font-mono text-3xl font-semibold ${up ? 'text-positive' : 'text-negative'}`}>
            {up ? '+' : '−'}{formatAmount(Math.abs(net))} <span className="text-base">tós</span>
          </p>
        </div>

        {/* Breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <Stat label="Apostado" value={formatAmount(data.wagered)} />
          <Stat label="Ganho" value={formatAmount(data.won)} tone="text-positive" />
          <Stat label="Jogadas" value={formatAmount(data.plays)} />
          <Stat label="Maior ganho" value={formatAmount(data.biggest)} tone="text-gold" />
        </div>

        <Button variant="primary" onClick={onClose} className="mt-5 w-full">
          Continuar
        </Button>
      </div>
    </div>,
    document.body,
  );
}

function Stat({ label, value, tone = 'text-text' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border border-border bg-bg/30 px-3 py-2.5">
      <p className="font-sans text-[10px] uppercase tracking-wide text-muted-2">{label}</p>
      <p className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

/**
 * Watches navigation and, when the player leaves a casino mini-game, surfaces a
 * session-summary popup (wagered / won / net / plays). Mounted once in the app
 * shell so individual game pages need no changes. Only pops if they actually
 * played (plays > 0).
 */
export function GameSessionTracker() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const current = useRef<EndedSession | null>(null);
  const [ended, setEnded] = useState<EndedSession | null>(null);

  useEffect(() => {
    const match = matchGame(pathname);
    const prev = current.current;

    // Left the previous game (to a non-game page or a different game).
    if (prev && (!match || match.label !== prev.label)) {
      setEnded(prev);
      current.current = null;
    }
    // Entered a (new) game — stamp the session start.
    if (match && (!prev || prev.label !== match.label)) {
      current.current = { ...match, startedAt: new Date().toISOString() };
    } else if (!match) {
      current.current = null;
    }
  }, [pathname]);

  if (!user || !ended) return null;
  return <GameExitSummary session={ended} onClose={() => setEnded(null)} />;
}
