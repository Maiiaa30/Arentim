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
    if (m) e[m[1]] = m[2].trim();
  }
  return e;
};
const server = readEnv(join(root, 'supabase', '.env'));
const front = readEnv(join(root, '.env'));

const DB = server.DATABASE_URL;
const SECRET = server.SYNC_SECRET;
const ANON = front.VITE_SUPABASE_ANON_KEY;
const BASE = 'https://kactlxdjoxjrqhmkjtfj.functions.supabase.co';
if (!DB || !SECRET || !ANON) {
  console.error('Missing DATABASE_URL / SYNC_SECRET / VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const headers = (extra) =>
  `jsonb_build_object('apikey', $$${ANON}$$, 'Authorization', $$Bearer ${ANON}$$, 'x-sync-secret', $$${SECRET}$$${extra ?? ''})`;

const jobSql = (name, schedule, fn) => `
  do $$ begin perform cron.unschedule('${name}'); exception when others then null; end $$;
  select cron.schedule('${name}', '${schedule}', $cmd$
    select net.http_post(url := '${BASE}/${fn}', headers := ${headers()});
  $cmd$);
`;

const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
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
  process.exit(1);
} finally {
  await client.end();
}
