import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { ChallengeClaimResult, ChallengeRow, RescueResult } from '@/types/db';

export function useChallenges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenges', user?.id] as const,
    enabled: !!user,
    queryFn: async (): Promise<ChallengeRow[]> => {
      const { data, error } = await supabase.rpc('list_challenges');
      if (error) throw error;
      return data;
    },
  });
}

export function useChallengeActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['challenges', user?.id] });
    void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
    void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
  };

  const claim = useMutation({
    mutationFn: async (key: string): Promise<ChallengeClaimResult> => {
      const { data, error } = await supabase.rpc('claim_challenge', { p_key: key });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });

  const rescue = useMutation({
    mutationFn: async (): Promise<RescueResult> => {
      const { data, error } = await supabase.rpc('claim_rescue');
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });

  return { claim, rescue };
}
