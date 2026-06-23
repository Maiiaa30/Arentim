#!/usr/bin/env node
/**
 * Shows migration status WITHOUT applying anything: how many files are recorded
 * as applied in public.arentim_migrations, and exactly which ones are still
 * pending. Read-only — safe to run any time.
 *
 * Usage: npm run db:status
 */
import { readdirSync } from 'node:fs';
import { connectWithFallback, migrationsDir } from './lib/db.mjs';

async function main() {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

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
    if (pending.length === 0) {
      console.log('Up to date — nothing to apply. ✅');
    } else {
      console.log('Pending (will be applied, in order, by `npm run db:migrate`):');
      for (const f of pending) console.log(`  → ${f}`);
    }
    // Flag any recorded version whose file is gone (e.g. renamed) — informational.
    const fileSet = new Set(files);
    const orphans = [...applied].filter((v) => !fileSet.has(v));
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
