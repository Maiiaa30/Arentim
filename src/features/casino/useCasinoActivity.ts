import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import type { CasinoActivity } from '@/types/db';

/** Live lobby activity — who's playing the shared rooms + recent big wins. */
export function useCasinoActivity() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['casino-activity', user?.id] as const,
    enabled: !!user,
    refetchInterval: 4000,
    queryFn: async (): Promise<CasinoActivity> => {
      const { data, error } = await supabase.rpc('casino_activity');
      if (error) throw error;
      return data ?? { crash: { players: 0, friends: 0 }, roulette: { players: 0, friends: 0 }, recent: [] };
    },
  });
}
