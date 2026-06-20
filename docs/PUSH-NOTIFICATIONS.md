# Push notifications (PWA Web Push)

Arentim is an installable PWA (manifest + `public/sw.js`). In-app notifications
(the bell) work out of the box. **OS-level push** — alerts that reach you when the
tab is closed — needs a one-time setup because it requires VAPID keys and a
deployed Edge Function. Until configured, the "Ativar alertas neste dispositivo"
toggle simply doesn't appear (it's gated on `VITE_VAPID_PUBLIC_KEY`).

## 1. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
# → Public Key:  B...   Private Key:  ...
```

## 2. Frontend env (public key only)

Add to `.env` (and to Vercel project env):

```
VITE_VAPID_PUBLIC_KEY=<the public key>
```

Rebuild/redeploy the frontend so the toggle shows up.

## 3. Edge Function secrets

```bash
supabase secrets set VAPID_PUBLIC_KEY=<public key>
supabase secrets set VAPID_PRIVATE_KEY=<private key>
supabase secrets set VAPID_SUBJECT=mailto:you@example.com
supabase secrets set PUSH_SECRET=<a long random string>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 4. Deploy the function (no JWT — it's called by a DB trigger)

```bash
set -a && . ./supabase/.env && set +a && \
  npx --yes supabase@latest functions deploy send-push \
  --no-verify-jwt --project-ref kactlxdjoxjrqhmkjtfj
```

## 5. Wire the dispatch trigger (sends a push for every new notification)

Run once in the SQL editor (kept OUT of migrations so it can't fire before the
function exists). Replace `<PUSH_SECRET>` with the value from step 3.

```sql
create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_push()
  returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
  perform net.http_post(
    url     := 'https://kactlxdjoxjrqhmkjtfj.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', '<PUSH_SECRET>'),
    body    := jsonb_build_object(
      'user_id', new.user_id, 'title', new.title,
      'body', new.body, 'link', new.link, 'tag', new.type)
  );
  return new;
end; $$;

drop trigger if exists trg_dispatch_push on public.notifications;
create trigger trg_dispatch_push after insert on public.notifications
  for each row execute function public.dispatch_push();
```

## How it fits together

`notifications` insert (friend request / accept / big win / gift / duel) →
`trg_dispatch_push` → `pg_net` POST → `send-push` Edge Function → Web Push to
every device in `push_subscriptions`. The browser service worker (`public/sw.js`)
shows the OS notification and focuses the app on click.

> Note: `send-push` uses `npm:web-push`. If the Deno runtime ever rejects it,
> swap to a Deno-native Web Push lib (e.g. `jsr:@negrel/webpush`) — the function
> body (look up subs → send → prune 404/410) stays the same.
