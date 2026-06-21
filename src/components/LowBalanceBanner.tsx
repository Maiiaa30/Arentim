import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/useProfile';

const LOW = 200;

/**
 * Gentle nudge when the player is nearly broke: points them at the daily bonus /
 * challenges and at asking a friend for tós. Dismissible for the session (the
 * AppLayout doesn't unmount on navigation, so it stays dismissed).
 */
export function LowBalanceBanner() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [dismissed, setDismissed] = useState(false);

  if (!user || dismissed || !profile || profile.balance > LOW) return null;

  return (
    <div className="border-b border-gold/20 bg-gold/[0.06]">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 sm:px-9">
        <span className="font-sans text-[13px] text-text">
          💰 Saldo baixo — <span className="text-muted">apanha mais tós:</span>
        </span>
        <Link to="/challenges" className="font-sans text-[12px] font-medium text-gold hover:text-gold-light">
          Bónus & desafios
        </Link>
        <span className="text-faint">·</span>
        <Link to="/friends" className="font-sans text-[12px] font-medium text-gold hover:text-gold-light">
          Pedir a um amigo
        </Link>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dispensar"
          className="ml-auto font-sans text-[11px] text-muted-2 hover:text-text"
        >
          Dispensar
        </button>
      </div>
    </div>
  );
}
