#!/usr/bin/env node
/**
 * Scaffolds a new migration file with the next version number and a header
 * template, so you never hand-pick a timestamp (and never collide). The project
 * uses a 14-digit `<date><6-digit-seq>` version that increments by 100000; this
 * takes the current max and adds 100000 so the new file always sorts last.
 *
 * Usage: npm run db:new "short description"
 *   e.g. npm run db:new "add referral bonus"  →  ..._add_referral_bonus.sql
 */
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { migrationsDir } from './lib/db.mjs';

const name = process.argv.slice(2).join(' ').trim();
if (!name) {
  console.error('Usage: npm run db:new "short description"');
  process.exit(1);
}

const slug = name
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents (á → a)
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 50);
if (!slug) {
  console.error('Description must contain letters or numbers.');
  process.exit(1);
}

const versions = readdirSync(migrationsDir)
  .map((f) => f.match(/^(\d{14})_/)?.[1])
  .filter(Boolean)
  .map((v) => BigInt(v));
const max = versions.length ? versions.reduce((a, b) => (b > a ? b : a)) : 20260618120000n;
const next = (max + 100000n).toString().padStart(14, '0');

const file = `${next}_${slug}.sql`;
const path = join(migrationsDir, file);
if (existsSync(path)) {
  console.error(`Refusing to overwrite existing ${file}`);
  process.exit(1);
}

const template = `-- ============================================================================
-- Arentim — ${name}.
--
-- TODO: describe what this migration does and why.
--
-- Write it IDEMPOTENTLY (create or replace / if not exists / on conflict do
-- nothing) so re-running is always safe. The runner applies it once and records
-- it in public.arentim_migrations. New RPCs must also be added to src/types/db.ts.
-- ============================================================================

`;

writeFileSync(path, template);
console.log(`Created supabase/migrations/${file}`);
