-- Admin on/off switches for casino games + individual slot machines.
--
-- Two layers:
--   * slot_machines.enabled  — hide a single machine from the slots floor.
--   * game_switches          — hide a whole game (crash, roleta, blackjack, …)
--                              from the casino lobby.
-- Disabling hides the game/machine from players (it drops out of the lobby and
-- the machine list). The flags are read by every authenticated client and only
-- written by admins through the SECURITY DEFINER RPCs below.

-- ---- Slot machines: per-machine enable flag --------------------------------
alter table public.slot_machines
  add column if not exists enabled boolean not null default true;

-- list_slot_machines now hides disabled machines (recreated from
-- 20260625300000_slots_classic_machine.sql with a WHERE enabled filter).
create or replace function public.list_slot_machines()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce(jsonb_agg(machine order by sort), '[]'::jsonb)
  from (
    select m.sort, jsonb_build_object(
      'key', m.key, 'name', m.name, 'blurb', m.blurb, 'accent', m.accent,
      'cabinet', m.cabinet,
      'min_bet', m.min_bet, 'max_bet', m.max_bet,
      'jackpot_symbol', m.jackpot_symbol,
      'progressive', m.progressive,
      'jackpot_pool', case when m.progressive then m.jackpot_pool else null end,
      'symbols', m.symbols,
      'paytable', (
        select jsonb_agg(
                 jsonb_build_object(
                   'id', s.id, 'glyph', s.glyph,
                   'mult', case when s.id = m.jackpot_symbol
                                then null
                                else (m.pay3 ->> s.id)::int end)
                 order by case when s.id = m.jackpot_symbol then 2147483647
                               else (m.pay3 ->> s.id)::int end desc)
        from jsonb_to_recordset(m.symbols) as s(id text, glyph text)
      )
    ) as machine
    from public.slot_machines m
    where coalesce(m.enabled, true)
  ) q;
$$;
revoke all on function public.list_slot_machines() from public;
grant execute on function public.list_slot_machines() to authenticated;

-- Admin view of EVERY machine (incl. disabled) with its flag.
create or replace function public.admin_list_machines()
  returns table (key text, name text, enabled boolean)
  language sql stable security definer set search_path = public as $$
  select m.key, m.name, coalesce(m.enabled, true)
  from public.slot_machines m
  where public.is_admin()
  order by m.sort;
$$;
revoke all on function public.admin_list_machines() from public;
grant execute on function public.admin_list_machines() to authenticated;

create or replace function public.admin_set_machine_enabled(p_key text, p_enabled boolean)
  returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.slot_machines set enabled = p_enabled where key = p_key;
  perform public.admin_audit(null, 'toggle_machine', jsonb_build_object('key', p_key, 'enabled', p_enabled));
end; $$;
revoke all on function public.admin_set_machine_enabled(text, boolean) from public;
grant execute on function public.admin_set_machine_enabled(text, boolean) to authenticated;

-- ---- Whole-game switches ----------------------------------------------------
create table if not exists public.game_switches (
  key        text primary key,
  label      text not null,
  enabled    boolean not null default true,
  sort       int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.game_switches enable row level security;
-- Read only via the RPC below; admins write only via the RPC.

-- Seed the lobby games (keys are the route's last segment, so the lobby can match
-- a tile to its switch). on conflict do nothing keeps re-runs + manual edits safe.
insert into public.game_switches (key, label, sort) values
  ('crash', 'Crash', 1),
  ('roulette', 'Roleta', 2),
  ('corrida', 'Corrida de Cavalos', 3),
  ('slots', 'Slots', 4),
  ('blackjack', 'Blackjack', 5),
  ('poker', 'Poker', 6),
  ('plinko', 'Plinko', 7),
  ('balatro', 'Balatró', 8),
  ('mines', 'Mines', 9),
  ('frango', 'Atravessa!', 10),
  ('wheel', 'Fita da Sorte', 11),
  ('chest', 'Jogo dos Copos', 12),
  ('maior-menor', 'Maior ou Menor', 13),
  ('sobe-e-desce', 'Sobe e Desce', 14),
  ('dice', 'Dados', 15),
  ('coinflip', 'Moeda', 16)
on conflict (key) do nothing;

create or replace function public.list_game_switches()
  returns table (key text, label text, enabled boolean)
  language sql stable security definer set search_path = public as $$
  select g.key, g.label, g.enabled from public.game_switches g order by g.sort;
$$;
revoke all on function public.list_game_switches() from public;
grant execute on function public.list_game_switches() to authenticated;

create or replace function public.admin_set_game_enabled(p_key text, p_enabled boolean)
  returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.game_switches set enabled = p_enabled, updated_at = now() where key = p_key;
  perform public.admin_audit(null, 'toggle_game', jsonb_build_object('key', p_key, 'enabled', p_enabled));
end; $$;
revoke all on function public.admin_set_game_enabled(text, boolean) from public;
grant execute on function public.admin_set_game_enabled(text, boolean) to authenticated;
