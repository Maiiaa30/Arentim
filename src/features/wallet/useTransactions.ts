import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Transaction, TransactionType } from '@/types/db';

export interface TransactionFilter {
  type?: TransactionType | 'all';
  limit?: number;
}

/** The signed-in user's ledger, newest first. RLS scopes it to our rows. */
export function useTransactions(filter: TransactionFilter = {}) {
  const { user } = useAuth();
  const { type = 'all', limit = 100 } = filter;

  return useQuery({
    queryKey: ['transactions', user?.id, type, limit] as const,
    enabled: !!user,
    queryFn: async (): Promise<Transaction[]> => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (type !== 'all') {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
