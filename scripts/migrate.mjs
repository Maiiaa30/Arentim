#!/usr/bin/env node
/**
 * Idempotent migration runner for Arentim.
 *
 * Applies every *.sql file in supabase/migrations (in filename order) that has
 * not yet been recorded as applied. Each file runs inside its own transaction
 * and is recorded in `public.arentim_migrations`. Re-running is safe: the SQL
 * itself is written idempotently, and already-recorded files are skipped.
 *
 * Connection string comes from DATABASE_URL (or DATABASE_POOL_URL, preferred) —
 * read from the environment or, if absent, from the gitignored supabase/.env.
 * The runner NEVER executes ad-hoc SQL: only the versioned files in
 * supabase/migrations.
 *
 * Networking note: Supabase's direct host (db.<ref>.supabase.co) is IPv6-only.
 * On IPv4-only networks that connection fails with ENETUNREACH, so when the
 * configured URL is a direct host we automatically fall back to the project's
 * IPv4 *session pooler* (aws-N-<region>.pooler.supabase.com). To pin the
 * endpoint explicitly, paste the dashboard's "Session pooler" URI into
 * DATABASE_POOL_URL (Project → Settings → Database → Connection string).
 *
 * Usage: npm run db:migrate
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');

// Supabase region hosting this project's pooler (override via env if it moves).
const POOL_REGION = process.env.SUPABASE_POOL_REGION || 'eu-west-3';
const NET_ERRORS = new Set(['ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']);

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

const baseOpts = { ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 };

/** Ordered list of connection candidates to try (first that connects wins). */
function buildCandidates() {
  const poolUrl = readEnvVar('DATABASE_POOL_URL');
  if (poolUrl) return [{ label: 'pooler (DATABASE_POOL_URL)', config: { connectionString: poolUrl, ...baseOpts } }];

  const url = readEnvVar('DATABASE_URL');
  if (!url) return [];
  const candidates = [{ label: 'direct (DATABASE_URL)', config: { connectionString: url, ...baseOpts } }];

  // If it's a Supabase direct host, append IPv4 session-pooler fallbacks.
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
        candidates.push({
          label: `session pooler aws-${n}-${POOL_REGION}`,
          config: { host: `aws-${n}-${POOL_REGION}.pooler.supabase.com`, ...shared },
        });
      }
    }
  } catch {
    /* not a URL we can rewrite — direct attempt only */
  }
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
      const note = NET_ERRORS.has(err.code) ? ` (${err.code})` : '';
      console.log(`• ${label} unavailable${note}; trying next…`);
      try { await client.end(); } catch { /* ignore */ }
    }
  }
  throw lastErr;
}

async function main() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const client = await connectWithFallback();

  try {
    await client.query(`
      create table if not exists public.arentim_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const { rows } = await client.query('select version from public.arentim_migrations');
    const applied = new Set(rows.map((r) => r.version));

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`• skip   ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      process.stdout.write(`→ apply  ${file} … `);
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into public.arentim_migrations (version) values ($1)', [file]);
        await client.query('commit');
        console.log('ok');
        count += 1;
      } catch (err) {
        await client.query('rollback');
        console.log('FAILED');
        throw err;
      }
    }
    console.log(count === 0 ? 'Up to date — nothing to apply.' : `Applied ${count} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
