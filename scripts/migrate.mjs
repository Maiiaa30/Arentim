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
import { join } from 'node:path';
import { connectWithFallback, migrationsDir } from './lib/db.mjs';

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

    // The active folder holds one squashed baseline plus any newer dated files;
    // the pre-squash migrations were moved to ./archive (ignored by this scan).
    const isBaseline = (f) => /_baseline\.sql$/.test(f);
    const dbInitialized = applied.size > 0;
    const archiveDir = join(migrationsDir, 'archive');
    const archivedPending = (
      existsSync(archiveDir) ? readdirSync(archiveDir).filter((f) => f.endsWith('.sql')).sort() : []
    ).filter((f) => !applied.has(f));

    let count = 0;
    let adopted = 0;

    // Apply one file in its own transaction and record it.
    const applyFile = async (dir, file) => {
      const sql = readFileSync(join(dir, file), 'utf8');
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
    };

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`• skip   ${file} (already applied)`);
        continue;
      }
      if (isBaseline(file)) {
        if (dbInitialized) {
          // Existing DB: the schema is already there from the archived steps, so
          // record the baseline WITHOUT running it. But first catch up any
          // archived migrations that were still pending when the squash landed —
          // their changes aren't applied yet and the baseline won't run, so apply
          // each one individually (idempotent, runs exactly once).
          for (const af of archivedPending) await applyFile(archiveDir, af);
          await client.query(
            'insert into public.arentim_migrations (version) values ($1) on conflict do nothing',
            [file],
          );
          console.log(`• adopt  ${file} (existing database — recorded without running)`);
          adopted += 1;
        } else {
          // Fresh DB: run the baseline to build the whole schema in one go.
          await applyFile(migrationsDir, file);
        }
        continue;
      }
      await applyFile(migrationsDir, file);
    }
    const adoptedNote = adopted > 0 ? ` Adopted ${adopted} baseline file(s) without running.` : '';
    console.log(
      (count === 0 ? 'Up to date — nothing to apply.' : `Applied ${count} migration(s).`) + adoptedNote,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
