#!/usr/bin/env node
/**
 * Schedule the football data jobs in Supabase (pg_cron + pg_net):
 *   - poll-live-scores every minute (live score updates)
 *   - sync-fixtures daily at 06:00 (refresh the fixture list)
 *
 * Reads DATABASE_URL + SYNC_SECRET from supabase/.env and the publishable key
 * from .env. Idempotent: unschedules any existing job of the same name first.
 * Run: node scripts/setup-cron.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readEnv = (f) => {
  const e = {};
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) e[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return e;
};
const server = readEnv(join(root, 'supabase', '.env'));
const front = readEnv(join(root, '.env'));

const SECRET = server.SYNC_SECRET;
const ANON = front.VITE_SUPABASE_ANON_KEY;
const BASE = 'https://kactlxdjoxjrqhmkjtfj.functions.supabase.co';
if (!server.DATABASE_URL || !SECRET || !ANON) {
  console.error('Missing DATABASE_URL / SYNC_SECRET / VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

// Many home networks are IPv4-only, but the direct Supabase host resolves to
// IPv6 (→ ENETUNREACH). Mirror migrate.mjs: prefer DATABASE_POOL_URL, else try
// the direct host then its IPv4 session pooler.
const POOL_REGION = process.env.SUPABASE_POOL_REGION || 'eu-west-3';
const NET_ERRORS = new Set(['ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']);
const baseOpts = { ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 };

function buildCandidates() {
  if (server.DATABASE_POOL_URL) return [{ label: 'pooler (DATABASE_POOL_URL)', config: { connectionString: server.DATABASE_POOL_URL, ...baseOpts } }];
  const url = server.DATABASE_URL;
  const out = [{ label: 'direct (DATABASE_URL)', config: { connectionString: url, ...baseOpts } }];
  try {
    const u = new URL(url);
    const ref = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
    if (ref) {
      const shared = { port: 5432, user: `postgres.${ref}`, password: decodeURIComponent(u.password), database: u.pathname.replace(/^\//, '') || 'postgres', ...baseOpts };
      for (const n of [0, 1]) out.push({ label: `session pooler aws-${n}-${POOL_REGION}`, config: { host: `aws-${n}-${POOL_REGION}.pooler.supabase.com`, ...shared } });
    }
  } catch { /* not rewritable */ }
  return out;
}

async function connectWithFallback() {
  let lastErr;
  for (const { label, config } of buildCandidates()) {
    const c = new pg.Client(config);
    try { await c.connect(); console.log(`Connected via ${label}.`); return c; }
    catch (err) { lastErr = err; console.log(`• ${label} unavailable${NET_ERRORS.has(err.code) ? ` (${err.code})` : ''}; trying next…`); try { await c.end(); } catch { /* ignore */ } }
  }
  throw lastErr;
}

const headers = (extra) =>
  `jsonb_build_object('apikey', $$${ANON}$$, 'Authorization', $$Bearer ${ANON}$$, 'x-sync-secret', $$${SECRET}$$${extra ?? ''})`;

const jobSql = (name, schedule, fn) => `
  do $$ begin perform cron.unschedule('${name}'); exception when others then null; end $$;
  select cron.schedule('${name}', '${schedule}', $cmd$
    select net.http_post(url := '${BASE}/${fn}', headers := ${headers()});
  $cmd$);
`;

let client;
try {
  client = await connectWithFallback();
  await client.query('create extension if not exists pg_net;');
  // pg_cron lives in the cron schema; create if the instance allows it.
  try { await client.query('create extension if not exists pg_cron;'); } catch (e) { console.log('(pg_cron extension note:', e.message + ')'); }

  await client.query(jobSql('poll-live-scores', '* * * * *', 'poll-live-scores'));
  await client.query(jobSql('sync-fixtures-daily', '0 6 * * *', 'sync-fixtures'));

  const { rows } = await client.query("select jobname, schedule, active from cron.job where jobname in ('poll-live-scores','sync-fixtures-daily') order by jobname;");
  console.log('✓ Scheduled jobs:');
  for (const r of rows) console.log(`   ${r.jobname}  [${r.schedule}]  active=${r.active}`);
  if (rows.length < 2) console.log('! Expected 2 jobs — check output above.');
} catch (e) {
  console.error('Failed:', e.message);
  if (NET_ERRORS.has(e.code)) {
    console.error('\nLooks like a network/IPv6 issue. Add the IPv4 Session Pooler URI to supabase/.env:');
    console.error('  DATABASE_POOL_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres');
    console.error('Find it in Supabase → Project → Settings → Database → Connection string → Session pooler.');
  }
  process.exit(1);
} finally {
  if (client) await client.end();
}
