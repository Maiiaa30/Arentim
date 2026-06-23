import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useUnreadCount, useMarkNotificationsRead } from '@/features/notifications/useNotifications';
import { useFriendRequests, useFriendActions } from '@/features/friends/useFriends';
import { useChallenges, useDailyChallenges } from '@/features/challenges/useChallenges';
import { UiIcon, type UiIconName } from '@/components/icons/UiIcon';
import type { NotificationRow } from '@/types/db';

/** "há 5 min" / "há 2 h" / "há 3 d" — compact PT-PT relative time. */
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

function iconFor(type: string): UiIconName {
  if (type === 'friend_request') return 'userPlus';
  if (type === 'friend_accept') return 'check';
  if (type === 'friend_win') return 'sparkle';
  if (type === 'gift') return 'gift';
  if (type === 'gift_request') return 'request';
  if (type === 'duel') return 'duel';
  if (type === 'duel_result') return 'trophy';
  return 'bell';
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);

  const { data: notifs = [] } = useNotifications();
  const { data: unread = 0 } = useUnreadCount();
  const { data: requests = [] } = useFriendRequests();
  const { data: challenges = [] } = useChallenges();
  const { data: daily = [] } = useDailyChallenges();
  const markRead = useMarkNotificationsRead();
  const { respond } = useFriendActions();

  const incoming = requests.filter((r) => r.direction === 'incoming');
  const claimable = [
    ...challenges.filter((c) => !c.claimed && c.progress >= c.target),
    ...daily.filter((c) => !c.claimed && c.progress >= c.target),
  ];
  const badge = unread + claimable.length;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Mark everything read when the panel is opened (the items stay listed).
  useEffect(() => {
    if (open && unread > 0) markRead.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Route a notification to the right tab (the stored link is just '/friends').
  const TAB_LINK: Record<string, string> = {
    duel: '/friends?tab=duels',
    duel_result: '/friends?tab=duels',
    friend_request: '/friends?tab=requests',
  };
  function go(n: NotificationRow) {
    setOpen(false);
    const link = TAB_LINK[n.type] ?? n.link;
    if (link) navigate(link);
  }

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        aria-label="Notificações"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-2 transition-colors hover:text-text"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3a6 6 0 0 0-6 6c0 3.5-1 5-2 6h16c-1-1-2-2.5-2-6a6 6 0 0 0-6-6Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gold px-1 font-mono text-[10px] font-bold text-bg">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-modal">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-display text-sm font-medium text-text">Notificações</span>
            {notifs.length > 0 && (
              <button
                className="font-sans text-[11px] text-muted-2 hover:text-text"
                onClick={() => markRead.mutate(undefined)}
              >
                Marcar como lidas
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {/* Pending friend requests — actionable */}
            {incoming.length > 0 && (
              <div className="border-b border-border/60 px-4 py-3">
                <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.18em] text-muted-2">Pedidos de amizade</p>
                <ul className="space-y-2">
                  {incoming.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="truncate font-sans text-sm text-text">{r.display_name}</span>
                      <span className="flex shrink-0 gap-1.5">
                        <button
                          className="focus-ring rounded bg-gold px-2.5 py-1 font-sans text-[11px] font-semibold text-bg disabled:opacity-50"
                          disabled={respond.isPending}
                          onClick={() => respond.mutate({ requestId: r.id, accept: true })}
                        >
                          Aceitar
                        </button>
                        <button
                          className="focus-ring rounded border border-border px-2.5 py-1 font-sans text-[11px] text-muted-2 hover:text-text disabled:opacity-50"
                          disabled={respond.isPending}
                          onClick={() => respond.mutate({ requestId: r.id, accept: false })}
                        >
                          Recusar
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Claimable challenges — actionable */}
            {claimable.length > 0 && (
              <button
                className="flex w-full items-center justify-between border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
                onClick={() => {
                  setOpen(false);
                  navigate('/challenges');
                }}
              >
                <span className="flex items-center gap-2">
                  <UiIcon name="trophy" className="h-4 w-4 text-gold" />
                  <span className="font-sans text-sm text-text">
                    {claimable.length} desafio{claimable.length > 1 ? 's' : ''} para reclamar
                  </span>
                </span>
                <span className="font-mono text-xs text-gold">
                  +{claimable.reduce((s, c) => s + c.reward, 0)} tós
                </span>
              </button>
            )}

            {/* Recent activity */}
            {notifs.length === 0 && incoming.length === 0 && claimable.length === 0 ? (
              <p className="px-4 py-8 text-center font-sans text-sm text-muted-2">Sem novidades por agora.</p>
            ) : (
              <ul>
                {notifs.map((n) => (
                  <li key={n.id}>
                    <button
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised ${
                        n.read_at ? '' : 'bg-gold/[0.05]'
                      }`}
                      onClick={() => go(n)}
                    >
                      <span className="mt-0.5 shrink-0 text-muted-2"><UiIcon name={iconFor(n.type)} className="h-[18px] w-[18px]" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-sans text-sm font-medium text-text">{n.title}</span>
                        {n.body && <span className="block font-sans text-[12px] leading-snug text-muted">{n.body}</span>}
                        <span className="mt-0.5 block font-mono text-[10px] text-faint">{ago(n.created_at)}</span>
                      </span>
                      {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" aria-hidden />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
