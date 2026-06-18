#!/usr/bin/env node
/**
 * Idempotent migration runner for Arentim.
 *
 * Applies every *.sql file in supabase/migrations (in filename order) that has
 * not yet been recorded as applied. Each file runs inside its own transaction
 * and is recorded in `public.arentim_migrations`. Re-running is safe: the SQL
 * itself is written idempotently, and already-recorded files are skipped.
 *
 * Connection string comes from DATABASE_URL — read from the environment or,
 * if absent, from the gitignored supabase/.env. The runner NEVER executes
 * ad-hoc SQL: only the versioned files in supabase/migrations.
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

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(root, 'supabase', '.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

async function main() {
  const databaseUrl = loadDatabaseUrl();
  if (!databaseUrl) {
    console.error('No DATABASE_URL found (set it in the environment or supabase/.env).');
    process.exit(1);
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

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
