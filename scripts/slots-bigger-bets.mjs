#!/usr/bin/env node
/**
 * Raise the slot machines' max bet so the new custom-bet field can stake more —
 * and therefore win more in absolute terms. This only changes the bet CAP, not
 * the payout multipliers, so the house edge / RTP is unchanged.
 *
 * Run: node scripts/slots-bigger-bets.mjs            (10x the current max)
 *      node scripts/slots-bigger-bets.mjs 20         (custom multiplier)
 *
 * Reads DATABASE_URL from supabase/.env.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const line = readFileSync(join(root, 'supabase', '.env'), 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL'));
const DB = line ? line.split('=')[1].trim() : null;
if (!DB) { console.error('Missing DATABASE_URL in supabase/.env'); process.exit(1); }

const factor = Math.max(2, Math.floor(Number(process.argv[2]) || 10));

const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query('update public.slot_machines set max_bet = max_bet * $1;', [factor]);
  const { rows } = await client.query('select key, min_bet, max_bet from public.slot_machines order by max_bet;');
  console.log(`✓ Raised every machine's max bet ${factor}x:`);
  for (const r of rows) console.log(`   ${r.key}: ${r.min_bet} – ${r.max_bet}`);
  console.log('Payout multipliers (and RTP) are unchanged — only the bet cap moved.');
} catch (e) {
  console.error('Failed:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
