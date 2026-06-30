-- ============================================================================
-- Arentim — auto-expire stale PUBLIC tables after 10 min of inactivity.
--
-- Users were seeing week-old tables cluttering the lobbies. Two parts:
--
--   1. The lobby list functions now hide any public table whose updated_at is
--      older than 10 minutes. This is the immediate, visible fix — stale tables
--      vanish from the browse list even before anything is actually pruned.
--
--   2. prune_stale_public_tables() actually retires the abandoned rows so they
--      stop accumulating. It is MONEY-SAFE by construction:
--        - Poker has chips at stake, so we only close EMPTY tables (zero seated
--          players ⇒ no chips on the table ⇒ nothing to strand). Tables that
--          still have anyone seated are never touched.
--        - Sueca and Battleship are free (no money), so stale abandoned rows can
--          be removed outright.
--      We never delete/close a table that still has players, and we never touch
--      private tables (code-only) or tables that are already finished/closed.
-- ============================================================================

-- 1a. Poker lobby list — same signature/body as 20260627200000, plus freshness.
create or replace function public.list_public_poker_tables()
  returns table (
    table_id  bigint,
    code      text,
    status    text,
    host_name text,
    buy_in    bigint,
    seats     int,
    max_seats int
  )
  language sql stable security definer set search_path = public, extensions as $$
  select t.id,
         t.code,
         t.status,
         coalesce(p.display_name, 'Anfitrião'),
         t.buy_in,
         coalesce(jsonb_array_length(t.state -> 'players'), 0),
         9
    from public.poker_tables t
    left join public.profiles p on p.id = t.host_id
   where t.is_public
     and t.status <> 'closed'
     and t.updated_at > now() - interval '10 minutes'
   order by t.updated_at desc
   limit 50;
$$;
revoke all on function public.list_public_poker_tables() from public;
grant execute on function public.list_public_poker_tables() to authenticated;

-- 1b. Sueca lobby list — same signature/body as 20260629300000, plus freshness.
create or replace function public.list_public_sueca_tables()
  returns table (
    table_id  bigint,
    code      text,
    status    text,
    host_name text,
    players   int
  )
  language sql stable security definer set search_path = public, extensions as $$
  select t.id,
         t.code,
         t.status,
         coalesce(p.display_name, 'Anfitrião'),
         (select count(*)::int from public.sueca_table_members m where m.table_id = t.id)
    from public.sueca_tables t
    left join public.profiles p on p.id = t.host_id
   where t.is_public
     and t.status = 'open'
     and t.updated_at > now() - interval '10 minutes'
   order by t.updated_at desc
   limit 50;
$$;
revoke all on function public.list_public_sueca_tables() from public;
grant execute on function public.list_public_sueca_tables() to authenticated;

-- 2. Prune the actual rows. Money-safe: poker only when EMPTY, free games freely.
create or replace function public.prune_stale_public_tables()
  returns void
  language plpgsql volatile security definer set search_path = public as $$
begin
  -- Poker: close only EMPTY public tables (no seated players ⇒ no chips at
  -- stake). Tables that still have players are left untouched so money is never
  -- stranded. We close (not delete) to preserve hand history / FKs.
  update public.poker_tables
     set status = 'closed', updated_at = now()
   where is_public
     and status <> 'closed'
     and updated_at < now() - interval '10 minutes'
     and coalesce(jsonb_array_length(state -> 'players'), 0) = 0;

  -- Sueca: free game, no money. sueca_table_members.table_id is ON DELETE
  -- CASCADE (see 20260621500000_sueca_tables.sql), so deleting the table row is
  -- safe. Only delete stale public tables that have NO members left.
  delete from public.sueca_tables
   where is_public
     and status <> 'closed'
     and updated_at < now() - interval '10 minutes'
     and not exists (
       select 1 from public.sueca_table_members m where m.table_id = sueca_tables.id
     );

  -- Battleship: free game, no money. Only stale, unclaimed public queue entries
  -- (still 'waiting' with no guest) — an in-progress game is never touched.
  delete from public.battleship_tables
   where is_public
     and status = 'waiting'
     and guest_id is null
     and updated_at < now() - interval '10 minutes';
end;
$$;
revoke all on function public.prune_stale_public_tables() from public;
grant execute on function public.prune_stale_public_tables() to authenticated;
