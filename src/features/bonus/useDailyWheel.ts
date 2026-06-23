import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileKey } from '@/features/profile/useProfile';
import type { DailySpinResult, DailySpinStatus, SpinSegment } from '@/types/db';

/** The wheel face (index → amount). Stable; cached aggressively. */
export function useSpinSegments() {
  return useQuery({
    queryKey: ['spin-segments'] as const,
    staleTime: Infinity,
    queryFn: async (): Promise<SpinSegment[]> => {
      const { data, error } = await supabase.rpc('spin_wheel_segments');
      if (error) throw error;
      return [...data].sort((a, b) => a.idx - b.idx);
    },
  });
}

/** Whether the user can spin today + when the wheel resets. */
export function useDailySpinStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['spin-status', user?.id] as const,
    enabled: !!user,
    queryFn: async (): Promise<DailySpinStatus> => {
      const { data, error } = await supabase.rpc('daily_spin_status');
      if (error) throw error;
      return data;
    },
  });
}

/** Performs the once-per-day spin (server draws the prize). */
export function useDailySpin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<DailySpinResult> => {
      const { data, error } = await supabase.rpc('daily_spin');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['spin-status', user?.id] });
      void qc.invalidateQueries({ queryKey: profileKey(user?.id) });
      void qc.invalidateQueries({ queryKey: ['transactions', user?.id] });
    },
  });
}
