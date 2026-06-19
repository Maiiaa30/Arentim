#!/usr/bin/env node
/**
 * Create a test account so the app can be exercised signed-in.
 *
 * Tries two ways, in order:
 *   1. Auth Admin API with the service/secret key (SUPABASE_SECRET_KEY from
 *      supabase/.env) — creates a *pre-confirmed* user, no email needed.
 *   2. Public signup with the publishable/anon key (VITE_SUPABASE_ANON_KEY from
 *      .env) — always valid (the app uses it). If the project has email
 *      confirmation OFF, the account is immediately usable; if ON, the account
 *      is created but must be confirmed (see the printed guidance).
 *
 * Usage (from repo root):
 *   node scripts/create-test-user.mjs                 # default email/password
 *   node scripts/create-test-user.mjs me@x.com pass   # custom
 *
 * Delete the user any time from the Supabase dashboard → Authentication.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readEnv(file) {
  const env = {};
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {
    /* missing file — handled by callers */
  }
  return env;
}

const server = readEnv(join(root, 'supabase', '.env'));
const front = readEnv(join(root, '.env'));
const URL = server.SUPABASE_URL || front.VITE_SUPABASE_URL;
const SECRET = server.SUPABASE_SECRET_KEY;
const ANON = front.VITE_SUPABASE_ANON_KEY;

if (!URL) {
  console.error('Missing SUPABASE_URL / VITE_SUPABASE_URL.');
  process.exit(1);
}

const email = process.argv[2] || 'tester@arentim.local';
const password = process.argv[3] || 'Arentim!Test2026';

const ready = () => {
  console.log('\n✓ Test account ready to sign in:');
  console.log(`    email:    ${email}`);
  console.log(`    password: ${password}`);
  console.log('  Sign in at the dev app (npm run dev). New accounts start with 5 000 Tostões.');
};

// ---- 1) Admin API (pre-confirmed) ----
async function tryAdmin() {
  if (!SECRET) return false;
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok && (body.id || body.user?.id)) {
    console.log('Created via Admin API (pre-confirmed).');
    return true;
  }
  if (/already.*registered|email.*exists/i.test(JSON.stringify(body))) {
    console.log('Admin API: user already exists — sign in with your password, or pass a new email.');
    return true;
  }
  console.log(`Admin API unavailable (${res.status}: ${body.msg || body.message || body.error_description || 'error'}). Falling back to signup…`);
  return false;
}

// ---- 2) Public signup (works if email confirmation is OFF) ----
async function trySignup() {
  if (!ANON) {
    console.error('No VITE_SUPABASE_ANON_KEY in .env to fall back to.');
    return false;
  }
  const res = await fetch(`${URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (/already.*registered|user.*exists/i.test(JSON.stringify(body))) {
      console.log('Signup: user already exists — sign in with your password (confirm it first if needed).');
      return true;
    }
    console.error(`Signup failed (${res.status}): ${body.msg || body.message || body.error_description || JSON.stringify(body)}`);
    return false;
  }
  const confirmed = body.access_token || body.session || body.user?.email_confirmed_at || body.user?.confirmed_at;
  if (confirmed) {
    console.log('Created via signup (email confirmation is OFF — account is active).');
    return true;
  }
  console.log('\n⚠ Account created, but this project has email confirmation ON, so it is not active yet.');
  console.log('  Fastest fix: Supabase dashboard → Authentication → Users → "Add user" →');
  console.log('  set this email/password and tick "Auto Confirm User". Or open the confirmation');
  console.log('  email link. Then it is ready:');
  return true;
}

if ((await tryAdmin()) || (await trySignup())) {
  ready();
} else {
  console.error('\nCould not create the account automatically.');
  console.error('Create it in the Supabase dashboard → Authentication → Users → "Add user"');
  console.error('(tick "Auto Confirm User"), then sign in with those credentials.');
  process.exit(1);
}
