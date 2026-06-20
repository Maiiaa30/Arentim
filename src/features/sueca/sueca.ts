// The Sueca engine lives in supabase/functions/_shared so the multiplayer Edge
// Function (Deno) and the frontend share one source of truth (same pattern as
// the poker engine). Re-exported here for `@/features/sueca/sueca` imports.
export * from '../../../supabase/functions/_shared/sueca';
