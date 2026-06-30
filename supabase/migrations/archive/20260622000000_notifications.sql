-- ============================================================================
-- Arentim — notifications. A per-user inbox powering the header bell. Rows are
-- written by triggers (friend request received / accepted, a friend's big win)
-- and read through SECURITY DEFINER RPCs scoped to auth.uid(). Claimable
-- challenges are NOT stored here — the bell derives that count client-side from
-- the existing list_challenges RPC.
-- ============================================================================

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, id desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- Reads / mutations -----------------------------------------------------
create or replace function public.list_notifications(p_limit int default 30)
  returns setof public.notifications
  language sql stable security definer set search_path = public as $$
  select * from public.notifications
   where user_id = auth.uid()
   order by id desc
   limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;
revoke all on function public.list_notifications(int) from public;
grant execute on function public.list_notifications(int) to authenticated;

create or replace function public.notifications_unread_count()
  returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications where user_id = auth.uid() and read_at is null;
$$;
revoke all on function public.notifications_unread_count() from public;
grant execute on function public.notifications_unread_count() to authenticated;

-- Mark some (or, when p_ids is null, all) of the caller's unread rows as read.
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
  returns void language plpgsql security definer set search_path = public as $$
begin
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null
     and (p_ids is null or id = any (p_ids));
end; $$;
revoke all on function public.mark_notifications_read(bigint[]) from public;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;

-- ============================================================================
-- Triggers — generators
-- ============================================================================

-- A pending friendship was created → tell the addressee.
create or replace function public.notify_friend_request()
  returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if new.status = 'pending' then
    select display_name into v_name from public.profiles where id = new.requester;
    insert into public.notifications (user_id, type, title, body, link, data)
    values (new.addressee, 'friend_request', 'Novo pedido de amizade',
            coalesce(v_name, 'Alguém') || ' quer ser teu amigo', '/friends',
            jsonb_build_object('from', new.requester, 'request_id', new.id));
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_friend_request on public.friendships;
create trigger trg_notify_friend_request after insert on public.friendships
  for each row execute function public.notify_friend_request();

-- A friendship row changed status (accepted, or re-requested after a decline).
create or replace function public.notify_friend_update()
  returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    select display_name into v_name from public.profiles where id = new.addressee;
    insert into public.notifications (user_id, type, title, body, link, data)
    values (new.requester, 'friend_accept', 'Pedido aceite',
            coalesce(v_name, 'Alguém') || ' aceitou o teu pedido de amizade', '/friends',
            jsonb_build_object('from', new.addressee));
  elsif new.status = 'pending' and old.status <> 'pending' then
    select display_name into v_name from public.profiles where id = new.requester;
    insert into public.notifications (user_id, type, title, body, link, data)
    values (new.addressee, 'friend_request', 'Novo pedido de amizade',
            coalesce(v_name, 'Alguém') || ' quer ser teu amigo', '/friends',
            jsonb_build_object('from', new.requester, 'request_id', new.id));
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_friend_update on public.friendships;
create trigger trg_notify_friend_update after update on public.friendships
  for each row execute function public.notify_friend_update();

-- A player banked a sizeable win → let their accepted friends know (social FOMO).
create or replace function public.notify_friend_win()
  returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_friend uuid; v_game text;
begin
  if new.type = 'win' and new.amount >= 1000 then
    select display_name into v_name from public.profiles where id = new.user_id;
    v_game := case
      when new.game is null then null
      when new.game = 'crash' then 'no Crash'
      when new.game = 'roulette' then 'na Roleta'
      when new.game = 'blackjack' then 'no Blackjack'
      when new.game = 'slots' then 'nas Slots'
      when new.game = 'coinflip' then 'no Moeda ao Ar'
      else 'em ' || initcap(new.game)
    end;
    for v_friend in
      select case when f.requester = new.user_id then f.addressee else f.requester end
        from public.friendships f
       where f.status = 'accepted' and (f.requester = new.user_id or f.addressee = new.user_id)
    loop
      insert into public.notifications (user_id, type, title, body, link, data)
      values (v_friend, 'friend_win',
              coalesce(v_name, 'Um amigo') || ' ganhou em grande',
              coalesce(v_name, 'Um amigo') || ' ganhou ' || new.amount || ' tós'
                || coalesce(' ' || v_game, ''),
              '/friends',
              jsonb_build_object('from', new.user_id, 'amount', new.amount, 'game', new.game));
    end loop;
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_friend_win on public.transactions;
create trigger trg_notify_friend_win after insert on public.transactions
  for each row execute function public.notify_friend_win();
