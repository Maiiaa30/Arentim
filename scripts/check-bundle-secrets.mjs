#!/usr/bin/env node
/**
 * Fails the build if a server-side secret leaked into the client bundle.
 *
 * Scans dist/ for unambiguous secret prefixes that must NEVER reach the browser:
 *   - sb_secret_   Supabase secret (service) key
 *   - sbp_         Supabase personal access token
 * The publishable key (sb_publishable_) and the project URL are public and
 * expected, so they are not flagged.
 *
 * Run after `npm run build`. Part of the security gate (CI + local).
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const FORBIDDEN = ['sb_secret_', 'sbp_'];

if (!existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const hits = [];
for (const file of walk(DIST)) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue; // skip binary/unreadable assets
  }
  for (const pat of FORBIDDEN) {
    if (content.includes(pat)) hits.push(`${file}: contains "${pat}"`);
  }
}

if (hits.length > 0) {
  console.error('SECURITY: secret-like values found in the built bundle:');
  for (const h of hits) console.error('  ' + h);
  process.exit(1);
}
console.log('Bundle secret scan: clean.');
