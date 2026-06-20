-- ============================================================================
-- Arentim — Web Push subscriptions. Stores a browser's push endpoint so the
-- send-push Edge Function can deliver OS notifications when the tab is closed.
-- Access only through SECURITY DEFINER RPCs scoped to auth.uid(); the send-push
-- function reads the table with the service key. See docs/PUSH-NOTIFICATIONS.md
-- for the VAPID setup + the dispatch trigger (kept out of migrations until the
-- function is deployed).
-- ============================================================================

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
-- No direct client policies — all access via the RPCs / service key.

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_endpoint is null or p_p256dh is null or p_auth is null then
    raise exception 'invalid subscription' using errcode = 'check_violation';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end; $$;
revoke all on function public.push_subscribe(text, text, text) from public;
grant execute on function public.push_subscribe(text, text, text) to authenticated;

create or replace function public.push_unsubscribe(p_endpoint text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end; $$;
revoke all on function public.push_unsubscribe(text) from public;
grant execute on function public.push_unsubscribe(text) to authenticated;
