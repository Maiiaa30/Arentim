// Arentim — send-push. Delivers a Web Push notification to every device a user
// has subscribed. Invoked SERVER-SIDE (by the notifications dispatch trigger via
// pg_net), authenticated with a shared x-push-secret — NOT a user JWT, so deploy
// with --no-verify-jwt. See docs/PUSH-NOTIFICATIONS.md for the full setup.
//
// Required Edge secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
// PUSH_SECRET. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected by the
// platform.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: { user_id?: string; title?: string; body?: string; link?: string; tag?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  if (!payload.user_id) return new Response('Bad Request', { status: 400 });

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!vapidPublic || !vapidPrivate) return new Response('VAPID not configured', { status: 500 });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@arentim.local', vapidPublic, vapidPrivate);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', payload.user_id);

  const body = JSON.stringify({
    title: payload.title ?? 'Arentim',
    body: payload.body ?? '',
    link: payload.link ?? '/',
    tag: payload.tag,
  });

  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      // 404/410 → the subscription is gone; prune it.
      if (code === 404 || code === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { 'content-type': 'application/json' },
  });
});
