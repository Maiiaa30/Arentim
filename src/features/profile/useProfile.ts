import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import type { LevelRewardResult, Profile } from '@/types/db';

export const profileKey = (userId: string | undefined) => ['profile', userId] as const;

/** The signed-in user's own profile. RLS guarantees we can only read our row. */
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileKey(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** Update display name / avatar via the scoped RPC. */
export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { display_name?: string; avatar_url?: string }) => {
      const { data, error } = await supabase.rpc('update_own_profile', {
        p_display_name: input.display_name ?? null,
        p_avatar_url: input.avatar_url ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
    },
  });
}

/** Claims the one-time reward for every level reached since the last claim. */
export function useClaimLevelRewards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<LevelRewardResult> => {
      const { data, error } = await supabase.rpc('claim_level_rewards');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
      void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
    },
  });
}
