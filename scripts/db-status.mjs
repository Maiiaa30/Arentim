#!/usr/bin/env node
/**
 * Shows migration status WITHOUT applying anything: how many files are recorded
 * as applied in public.arentim_migrations, and exactly which ones are still
 * pending. Read-only — safe to run any time.
 *
 * Usage: npm run db:status
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { connectWithFallback, migrationsDir } from './lib/db.mjs';

async function main() {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  // Squashed migrations live in ./archive (ignored by the runner); their recorded
  // versions are expected, not "orphans".
  const archiveDir = join(migrationsDir, 'archive');
  const archived = existsSync(archiveDir)
    ? new Set(readdirSync(archiveDir).filter((f) => f.endsWith('.sql')))
    : new Set();

  const client = await connectWithFallback();
  try {
    const exists = await client.query(`select to_regclass('public.arentim_migrations') as t`);
    if (!exists.rows[0].t) {
      console.log('\nNo arentim_migrations table yet — nothing has been applied.');
      console.log(`${files.length} migration file(s) pending. Run: npm run db:migrate`);
      return;
    }
    const { rows } = await client.query('select version from public.arentim_migrations');
    const applied = new Set(rows.map((r) => r.version));
    const pending = files.filter((f) => !applied.has(f));

    console.log(`\n${files.length} file(s) · ${applied.size} applied · ${pending.length} pending\n`);
    const dbInitialized = applied.size > 0;
    if (pending.length === 0) {
      console.log('Up to date — nothing to apply. ✅');
    } else {
      console.log('Pending (will be applied, in order, by `npm run db:migrate`):');
      for (const f of pending) {
        const adopt = /_baseline\.sql$/.test(f) && dbInitialized;
        console.log(`  → ${f}${adopt ? '  (baseline — recorded without running on this existing DB)' : ''}`);
      }
    }
    // Archived migrations that were still pending when the squash landed — the
    // runner applies these individually before adopting the baseline.
    const archivedPending = [...archived].filter((v) => !applied.has(v)).sort();
    if (archivedPending.length) {
      console.log(`\n${archivedPending.length} archived file(s) pending — db:migrate will apply these as catch-up:`);
      for (const v of archivedPending) console.log(`  → ${v}`);
    }
    // Flag any recorded version whose file is gone (e.g. renamed) — informational.
    // Archived (squashed) files are expected, so they don't count.
    const fileSet = new Set(files);
    const orphans = [...applied].filter((v) => !fileSet.has(v) && !archived.has(v));
    if (orphans.length) {
      console.log(`\nNote: ${orphans.length} applied record(s) have no matching file (renamed/removed):`);
      for (const v of orphans) console.log(`  · ${v}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Status check failed:', err.message);
  process.exit(1);
});
