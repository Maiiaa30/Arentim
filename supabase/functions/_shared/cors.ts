// Shared CORS headers for browser-invoked Edge Functions. `supabase-js`'s
// functions.invoke() sends apikey/authorization/content-type, which makes the
// browser fire a preflight OPTIONS — without these headers (and an OPTIONS
// handler) the call is blocked before the function ever runs.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
