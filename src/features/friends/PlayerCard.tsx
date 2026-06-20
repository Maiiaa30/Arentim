import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePublicProfile } from './usePublicProfile';
import { useFriendActions } from './useFriends';
import { useDuelRecord } from './useDuels';
import { winRate } from '@/features/profile/stats';
import { evaluateAchievements, PUBLIC_ACHIEVEMENT_KEYS } from '@/features/profile/achievements';
import { RingAvatar } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { formatTos } from '@/lib/format';
import type { FriendStatus } from '@/types/db';

const memberSince = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short' });

const STATUS_TEXT: Record<FriendStatus, string> = {
  self: 'Este é você',
  friends: 'Já são amigos',
  pending_out: 'Pedido enviado',
  pending_in: 'Aceitar pedido',
  none: 'Adicionar amigo',
};

/** Mini popup with a player's public stats + a friend-request action. */
export function PlayerCard({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data: p, isLoading } = usePublicProfile(userId);
  const { data: record } = useDuelRecord(userId);
  const { sendRequest } = useFriendActions();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // 'none' sends a request; 'pending_in' auto-accepts the mutual invite (the RPC handles both).
  const canAct = p?.friend_status === 'none' || p?.friend_status === 'pending_in';

  async function act() {
    if (!p) return;
    setMsg(null);
    try {
      const status = await sendRequest.mutateAsync(p.id);
      setMsg(status === 'accepted' || status === 'already_friends' ? 'Agora são amigos!' : 'Pedido enviado.');
      void qc.invalidateQueries({ queryKey: ['public-profile', userId] });
    } catch {
      setMsg('Não foi possível enviar o pedido.');
    }
  }

  // Rendered in a portal at <body>: keeps the overlay out of the lobby's
  // continuously-animating subtree. A static scrim (no live backdrop-filter)
  // avoids the per-frame re-blur of the moving game art behind it, which is what
  // made the popup flicker.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full max-w-sm border-border-strong p-6 shadow-modal animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !p ? (
          <p className="py-8 text-center text-muted-2">A carregar…</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <RingAvatar initials={p.display_name.slice(0, 2).toUpperCase()} size={56} />
              <div>
                <h3 className="font-display text-xl font-medium text-text">{p.display_name}</h3>
                <p className="font-sans text-xs text-muted-2">Membro desde {memberSince(p.created_at)}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-sans text-[10px] uppercase tracking-wider text-muted-2">Jogos</p>
                <p className="font-display text-lg text-text">{p.games_played}</p>
              </div>
              <div>
                <p className="font-sans text-[10px] uppercase tracking-wider text-muted-2">Vitórias</p>
                <p className="font-display text-lg text-text">{winRate(p)}%</p>
              </div>
              <div>
                <p className="font-sans text-[10px] uppercase tracking-wider text-muted-2">Maior ganho</p>
                <p className="font-display text-lg text-gold">{formatTos(p.biggest_win)}</p>
              </div>
            </div>

            {(() => {
              const badges = evaluateAchievements({
                balance: 0, total_wagered: 0,
                games_played: p.games_played, games_won: p.games_won,
                biggest_win: p.biggest_win, streak_count: p.streak_count,
              }).filter((a) => PUBLIC_ACHIEVEMENT_KEYS.has(a.key) && a.unlocked);
              if (badges.length === 0) return null;
              return (
                <div className="mt-5">
                  <p className="mb-1.5 font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Conquistas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {badges.map((a) => (
                      <span key={a.key} title={a.title} className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 bg-gold/[0.06] text-base">
                        {a.icon}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {p.friend_status !== 'self' && record && record.total > 0 && (
              <div className="mt-4 rounded-lg border border-border bg-surface-raised/40 px-3 py-2 text-center">
                <span className="font-sans text-[11px] uppercase tracking-[0.16em] text-muted-2">Duelos entre vocês</span>
                <p className="mt-0.5 font-display text-sm">
                  <span className="font-bold text-positive">{record.wins}V</span>
                  <span className="text-muted-2"> – </span>
                  <span className="font-bold text-negative">{record.losses}D</span>
                </p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="secondary" onClick={onClose} className="!px-4 !py-2">
                Fechar
              </Button>
              {p.friend_status === 'self' ? null : canAct ? (
                <Button variant="primary" onClick={act} disabled={sendRequest.isPending} className="!px-4 !py-2">
                  {STATUS_TEXT[p.friend_status]}
                </Button>
              ) : (
                <span className="font-sans text-sm text-muted-2">{STATUS_TEXT[p.friend_status]}</span>
              )}
            </div>
            {msg && <p className="mt-3 text-center text-sm text-positive">{msg}</p>}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
