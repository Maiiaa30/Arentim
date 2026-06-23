/**
 * Shared DB connection + env helpers for the Arentim migration tooling
 * (db:migrate, db:status). Extracted so the runner and the status command use
 * one identical, battle-tested connection path. See scripts/migrate.mjs for the
 * networking notes (IPv6 direct host → IPv4 session-pooler fallback).
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
export const root = join(here, '..', '..');
export const migrationsDir = join(root, 'supabase', 'migrations');

const POOL_REGION = process.env.SUPABASE_POOL_REGION || 'eu-west-3';
const NET_ERRORS = new Set(['ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']);
const baseOpts = { ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 };

export function readEnvVar(name) {
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

/** Ordered list of connection candidates to try (first that connects wins). */
function buildCandidates() {
  const poolUrl = readEnvVar('DATABASE_POOL_URL');
  if (poolUrl) return [{ label: 'pooler (DATABASE_POOL_URL)', config: { connectionString: poolUrl, ...baseOpts } }];

  const url = readEnvVar('DATABASE_URL');
  if (!url) return [];
  const candidates = [{ label: 'direct (DATABASE_URL)', config: { connectionString: url, ...baseOpts } }];

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

export async function connectWithFallback() {
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
