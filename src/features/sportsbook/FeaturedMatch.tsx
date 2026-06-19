import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DailyContent } from '@/types/db';

/** The latest AI-generated "featured match" blurb, if any. Text-only, escaped. */
export function FeaturedMatch() {
  const { data } = useQuery({
    queryKey: ['daily-content', 'featured'] as const,
    queryFn: async (): Promise<DailyContent | null> => {
      const { data, error } = await supabase
        .from('daily_content')
        .select('*')
        .eq('kind', 'featured')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!data) return null;
  return (
    <section className="card border-accent/30 bg-accent/5 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Featured match</p>
      <p className="mt-1 font-display text-lg font-semibold text-text">{data.title}</p>
      <p className="mt-1 text-sm text-muted">{data.body}</p>
    </section>
  );
}
