// Shared CORS headers for browser-invoked Edge Functions. `supabase-js`'s
// functions.invoke() sends apikey/authorization/content-type, which makes the
// browser fire a preflight OPTIONS — without these headers (and an OPTIONS
// handler) the call is blocked before the function ever runs.
//
// Origin lock-down: set the `ALLOWED_ORIGIN` secret to your site origin
// (e.g. https://arentim.app) to restrict which web origin may call the
// functions from a browser. Defaults to `*` when unset, so nothing breaks until
// you opt in (`supabase secrets set ALLOWED_ORIGIN=https://your-site`).
const ALLOW_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};
