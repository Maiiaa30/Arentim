#!/usr/bin/env node
/**
 * Deploy Supabase Edge Functions without retyping the env-sourcing dance.
 *
 * Edge function code does NOT auto-deploy (only the frontend does, via Vercel on
 * merge). This loads the credentials from the gitignored `supabase/.env`
 * (SUPABASE_ACCESS_TOKEN etc.) into the environment and runs the Supabase CLI.
 *
 *   npm run deploy:functions                  # poker-bots + poker-table
 *   npm run deploy:functions poker-table      # just one
 *   npm run deploy:functions a b c            # any list
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const PROJECT_REF = 'kactlxdjoxjrqhmkjtfj';
const DEFAULT_FUNCTIONS = ['poker-bots', 'poker-table'];

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '..', 'supabase', '.env');

try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !line.trimStart().startsWith('#')) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
} catch {
  console.error(`Could not read ${envPath} — needed for SUPABASE_ACCESS_TOKEN.`);
  process.exit(1);
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FUNCTIONS;
console.log(`Deploying: ${targets.join(', ')}`);

const result = spawnSync(
  'npx',
  ['--yes', 'supabase@latest', 'functions', 'deploy', ...targets, '--project-ref', PROJECT_REF],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(result.status ?? 1);
