-- ============================================================================
-- Arentim — Batalha Naval ("Salva de Torpedos"). A 5×5 ocean hides a fleet of
-- 5 ship cells; the player fires a salvo of 5 torpedoes (one at a time) and is
-- paid by how many ships were hit. Keno-style: no bust — you fire the whole
-- salvo, settle on the last shot. Server-authoritative: the fleet is drawn with
-- the CSPRNG and stored HIDDEN (the round table has NO client SELECT policy —
-- only the cells you already fired at are ever revealed, via the RPCs).
--
-- Paytable (hits → multiplier), tuned to a ~3.4% house edge over the
-- hypergeometric hit distribution (N=25, K=5 ships, T=5 shots):
--   0–1 → 0   2 → 2×   3 → 10×   4 → 80×   5 → 1500× (frota afundada)
-- ============================================================================

create table if not exists public.naval_rounds (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  stake      bigint not null check (stake > 0),
  ship_cells int[] not null,                 -- the hidden fleet (5 cells, 0..24)
  shots      int[] not null default '{}',    -- cells fired at so far
  created_at timestamptz not null default now()
);
-- Hidden info (ship_cells) → RLS enabled, NO select policy (reads via RPC only).
alter table public.naval_rounds enable row level security;

-- Fixed game shape.
--   board = 25 cells, fleet = 5 ship cells, salvo = 5 torpedoes.

-- Payout multiplier for a number of hits (immutable lookup).
create or replace function public.naval_pay(p_hits int)
  returns numeric language sql immutable as $$
  select case p_hits
           when 5 then 1500
           when 4 then 80
           when 3 then 10
           when 2 then 2
           else 0
         end::numeric;
$$;

-- ---- naval_start ------------------------------------------------------------
create or replace function public.naval_start(p_stake bigint)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint; v_after bigint;
  v_deck int[]; v_i int; v_j int; v_tmp int; v_ships int[];
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  delete from public.naval_rounds where user_id = v_uid;  -- abandon = loss

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'batalha_naval', -p_stake, v_after, 'batalha naval');
  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;

  -- Shuffle [0..24] (Fisher–Yates, 1-indexed arrays) and take the first 5 as the fleet.
  v_deck := array(select generate_series(0, 24));
  for v_i in reverse 25..2 loop
    v_j := public.csprng_below(v_i);  -- 0..i-1
    v_tmp := v_deck[v_i]; v_deck[v_i] := v_deck[v_j + 1]; v_deck[v_j + 1] := v_tmp;
  end loop;
  v_ships := v_deck[1:5];

  insert into public.naval_rounds (user_id, stake, ship_cells) values (v_uid, p_stake, v_ships);

  return jsonb_build_object('ships', 5, 'salvo', 5, 'shots', '[]'::jsonb, 'hits', 0, 'balance', v_after);
end; $$;
revoke all on function public.naval_start(bigint) from public;
grant execute on function public.naval_start(bigint) to authenticated;

-- ---- naval_fire -------------------------------------------------------------
create or replace function public.naval_fire(p_cell int)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.naval_rounds;
  v_hit boolean; v_shots int[]; v_hits int; v_mult numeric; v_payout bigint;
  v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_cell is null or p_cell < 0 or p_cell > 24 then raise exception 'invalid cell' using errcode = 'check_violation'; end if;

  select * into v_r from public.naval_rounds where user_id = v_uid for update;
  if not found then raise exception 'no round' using errcode = 'check_violation'; end if;
  if p_cell = any (v_r.shots) then raise exception 'already fired' using errcode = 'check_violation'; end if;

  v_shots := v_r.shots || p_cell;
  v_hit := p_cell = any (v_r.ship_cells);
  select count(*) into v_hits from unnest(v_shots) as s where s = any (v_r.ship_cells);

  if array_length(v_shots, 1) >= 5 then
    -- Salvo complete → settle by hit count.
    v_mult := public.naval_pay(v_hits);
    v_payout := floor(v_r.stake * v_mult);
    delete from public.naval_rounds where user_id = v_uid;

    if v_payout > 0 then
      select balance into v_balance from public.profiles where id = v_uid for update;
      v_after := v_balance + v_payout;
      insert into public.transactions (user_id, type, game, amount, balance_after, note)
      values (v_uid, 'win', 'batalha_naval', v_payout, v_after, format('batalha naval %s acertos %sx', v_hits, v_mult));
      update public.profiles set balance = v_after, total_won = total_won + v_payout,
             games_won = games_won + 1, biggest_win = greatest(biggest_win, v_payout) where id = v_uid;
    else
      select balance into v_after from public.profiles where id = v_uid;
    end if;

    insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
    values (v_uid, 'batalha_naval', v_r.stake, v_payout,
            jsonb_build_object('hits', v_hits, 'ships', to_jsonb(v_r.ship_cells)),
            jsonb_build_object('multiplier', v_mult, 'shots', to_jsonb(v_shots)));

    return jsonb_build_object('hit', v_hit, 'cell', p_cell, 'shots', to_jsonb(v_shots),
      'hits', v_hits, 'done', true, 'multiplier', v_mult, 'payout', v_payout,
      'ships', to_jsonb(v_r.ship_cells), 'balance', v_after);
  end if;

  update public.naval_rounds set shots = v_shots where user_id = v_uid;
  return jsonb_build_object('hit', v_hit, 'cell', p_cell, 'shots', to_jsonb(v_shots),
    'hits', v_hits, 'shots_left', 5 - array_length(v_shots, 1), 'done', false);
end; $$;
revoke all on function public.naval_fire(int) from public;
grant execute on function public.naval_fire(int) to authenticated;

-- ---- naval_current ----------------------------------------------------------
-- Resume a partially-fired salvo (the stake is locked in it). Only reveals the
-- cells already fired at + whether each was a hit — never the unfired fleet.
create or replace function public.naval_current()
  returns jsonb language plpgsql stable security definer
  set search_path = public, extensions
as $$
declare v_r public.naval_rounds; v_hits int; v_flags jsonb;
begin
  if auth.uid() is null then return null; end if;
  select * into v_r from public.naval_rounds where user_id = auth.uid();
  if not found then return null; end if;
  select coalesce(count(*) filter (where s = any (v_r.ship_cells)), 0),
         coalesce(jsonb_agg(s = any (v_r.ship_cells) order by ord), '[]'::jsonb)
    into v_hits, v_flags
    from unnest(v_r.shots) with ordinality as t(s, ord);
  return jsonb_build_object('stake', v_r.stake, 'ships', 5, 'salvo', 5,
    'shots', to_jsonb(v_r.shots), 'hit_flags', v_flags, 'hits', v_hits);
end; $$;
revoke all on function public.naval_current() from public;
grant execute on function public.naval_current() to authenticated;
