import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surface a clear message in development; in production the build inlines
  // real values. Never log the key itself.
  console.warn(
    '[arentim] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — auth and data will not work. Copy .env.example to .env.',
  );
}

/**
 * Singleton Supabase client for the browser. Uses ONLY the public anon key.
 * Trusted operations (money mutations, dealing cards, settling bets) run in
 * Edge Functions with the service key — never here.
 */
export const supabase = createClient<Database>(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-missing',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
