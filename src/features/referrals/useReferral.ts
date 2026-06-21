import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';

const REF_STORAGE_KEY = 'arentim:ref';

export type Referral = {
  code: string | null;
  referred_by: string | null;
  referred_count: number;
};

/** The signed-in user's referral code + how many friends they've brought in. */
export function useReferral() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['referral', user?.id] as const,
    enabled: !!user,
    queryFn: async (): Promise<Referral> => {
      const { data, error } = await supabase.rpc('my_referral');
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Once the user is authenticated, redeem any pending referral code stashed at
 * signup (survives the email-confirm round-trip). The RPC is idempotent and
 * rejects self/repeat claims, so it's safe to fire once per session. On success
 * we clear the key and refresh the profile so the new balance shows.
 */
export function useReferralClaim(): void {
  const { user } = useAuth();
  const qc = useQueryClient();
  const claimedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const code = localStorage.getItem(REF_STORAGE_KEY);
    if (!code) return;
    if (claimedFor.current === user.id) return;
    claimedFor.current = user.id;

    void (async () => {
      const { data, error } = await supabase.rpc('claim_referral', { p_code: code });
      // Clear the pending code unless it was a transient transport error — a
      // resolved claim (claimed / already / invalid) should not be retried.
      if (!error) {
        localStorage.removeItem(REF_STORAGE_KEY);
        if (data && 'status' in data && data.status === 'claimed') {
          void qc.invalidateQueries({ queryKey: profileKey(user.id) });
          void qc.invalidateQueries({ queryKey: ['referral', user.id] });
        }
      } else {
        // Allow a retry on the next mount if the network call failed.
        claimedFor.current = null;
      }
    })();
  }, [user, qc]);
}
