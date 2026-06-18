# Supabase — database & migrations

Schema, RLS policies, and trusted server functions live in `migrations/` as
plain, versioned SQL. Apply them in filename order.

## Applying a migration

You can apply migrations any of these ways — pick one:

**A. Repo runner (recommended)** — idempotent, tracks what's applied.

```bash
npm run db:migrate
```

Reads `DATABASE_URL` from `supabase/.env`, applies any un-applied files in
`migrations/` (each in its own transaction), and records them in
`public.arentim_migrations`. Re-running is safe. This is the command used to
delegate migrations — it only ever runs the versioned files in `migrations/`,
never ad-hoc SQL.

**B. Supabase Dashboard**

1. Open your project → **SQL Editor** → **New query**.
2. Paste the contents of the next un-applied file in `migrations/` (in order).
3. Run it. Re-running is safe — the SQL is written to be idempotent.

**C. Supabase CLI** (no Docker needed for a remote push)

```bash
npx supabase db push --db-url "$DATABASE_URL"
```

`DATABASE_URL` is the direct connection string (kept in `supabase/.env`, never
committed).

## After the first migration (`*_init_auth_wallet.sql`)

1. **Sign up** in the app to create your account (this fires the
   `handle_new_user` trigger, seeding a profile + 5.000 Tostões welcome bonus).
2. **Make yourself an admin.** In the SQL Editor:

   ```sql
   update public.profiles
      set is_admin = true
    where id = (select id from auth.users where email = 'YOUR_EMAIL');
   ```

## Security notes

- RLS is **enabled and forced** on every table; the default is deny.
- The client can never change its own balance. All money moves through
  `apply_ledger_entry`, which is `SECURITY DEFINER`, locks the profile row, and
  has `EXECUTE` revoked from `anon`/`authenticated` — only trusted server code
  (Edge Functions using the service key) can call it.
- The only client-callable mutations are `update_own_profile` (display
  name/avatar) and `touch_last_online`, both scoped to `auth.uid()`.
