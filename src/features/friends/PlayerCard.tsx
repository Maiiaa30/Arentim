import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePublicProfile } from './usePublicProfile';
import { useFriendActions } from './useFriends';
import { winRate } from '@/features/profile/stats';
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
