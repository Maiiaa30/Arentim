#!/usr/bin/env node
/**
 * DANGER — wipe ALL players and gameplay data for a fresh public launch.
 *
 * Deletes every auth user (which cascade-deletes their profile and ALL
 * user-owned rows: transactions, game_rounds, bets, friendships, duels,
 * notifications, crash/roulette/cups/hilo rounds, poker/sueca tables, onze
 * scores, admin actions, announcements …), then truncates the shared live-room
 * tables (which are not user-owned) and reseeds the progressive jackpot pool.
 *
 * KEEPS config/seed data: challenge_catalog, slot_machines, fixtures,
 * daily_content, the migrations ledger.
 *
 * This is IRREVERSIBLE. You must pass --yes to run it.
 *
 * Connection: DATABASE_POOL_URL (preferred) or DATABASE_URL, from the env or the
 * gitignored supabase/.env — same resolution as scripts/migrate.mjs, including
 * the IPv4 session-pooler fallback.
 *
 * Usage (from repo root):
 *   npm run db:reset -- --yes
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const POOL_REGION = process.env.SUPABASE_POOL_REGION || 'eu-west-3';
const NET_ERRORS = new Set(['ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']);
const baseOpts = { ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 };

function readEnvVar(name) {
  if (process.env[name]) return process.env[name];
  const envPath = join(root, 'supabase', '.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`));
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

function buildCandidates() {
  const poolUrl = readEnvVar('DATABASE_POOL_URL');
  if (poolUrl) return [{ label: 'pooler (DATABASE_POOL_URL)', config: { connectionString: poolUrl, ...baseOpts } }];
  const url = readEnvVar('DATABASE_URL');
  if (!url) return [];
  const candidates = [{ label: 'direct (DATABASE_URL)', config: { connectionString: url, ...baseOpts } }];
  try {
    const u = new URL(url);
    const ref = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
    if (ref) {
      const shared = {
        port: 5432,
        user: `postgres.${ref}`,
        password: decodeURIComponent(u.password),
        database: u.pathname.replace(/^\//, '') || 'postgres',
        ...baseOpts,
      };
      for (const n of [0, 1]) {
        candidates.push({ label: `session pooler aws-${n}-${POOL_REGION}`, config: { host: `aws-${n}-${POOL_REGION}.pooler.supabase.com`, ...shared } });
      }
    }
  } catch { /* not a rewritable URL */ }
  return candidates;
}

async function connectWithFallback() {
  const candidates = buildCandidates();
  if (candidates.length === 0) {
    console.error('No DATABASE_URL found (set it in the environment or supabase/.env).');
    process.exit(1);
  }
  let lastErr;
  for (const { label, config } of candidates) {
    const client = new pg.Client(config);
    try {
      await client.connect();
      console.log(`Connected via ${label}.`);
      return client;
    } catch (err) {
      lastErr = err;
      console.log(`• ${label} unavailable${NET_ERRORS.has(err.code) ? ` (${err.code})` : ''}; trying next…`);
      try { await client.end(); } catch { /* ignore */ }
    }
  }
  throw lastErr;
}

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('Refusing to run without --yes.\n\nThis IRREVERSIBLY deletes every player and all gameplay data.\nRun:  npm run db:reset -- --yes');
    process.exit(1);
  }

  const client = await connectWithFallback();
  try {
    const before = await client.query('select count(*)::int as n from auth.users');
    console.log(`Users before: ${before.rows[0].n}`);

    console.log('Deleting all auth users (cascades profiles + all user-owned data)…');
    await client.query('delete from auth.users');

    console.log('Truncating shared live-room tables…');
    // Guard each table so the script still works if a table is absent locally.
    await client.query(`do $$
      begin
        if to_regclass('public.crash_rooms') is not null then truncate public.crash_rooms restart identity cascade; end if;
        if to_regclass('public.roulette_rooms') is not null then truncate public.roulette_rooms restart identity cascade; end if;
      end $$;`);

    console.log('Reseeding progressive jackpot pools…');
    await client.query(`update public.slot_machines set jackpot_pool = jackpot_seed where progressive`);

    const after = await client.query('select count(*)::int as n from auth.users');
    console.log(`\nDone. Users now: ${after.rows[0].n}. Config (catalogs, slot machines, fixtures) kept.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Reset failed:', err.message || err);
  process.exit(1);
});
