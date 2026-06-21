-- ============================================================================
-- Arentim — Mines. A 5×5 grid hides N mines; reveal safe tiles to grow the
-- multiplier and cash out before hitting one. Server-authoritative: the mine
-- layout is drawn with the CSPRNG and stored HIDDEN (the round table has NO
-- client SELECT policy — reads go only through the RPCs). Fair multiplier with a
-- 3% house edge: after k safe picks, mult = 0.97 · ∏ (25−i)/(25−mines−i).
-- ============================================================================

create table if not exists public.mines_rounds (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  stake      bigint not null check (stake > 0),
  mines      int not null check (mines between 1 and 24),
  mine_cells int[] not null,
  picks      int[] not null default '{}',
  created_at timestamptz not null default now()
);
-- Hidden info (mine_cells) → RLS enabled, NO select policy (reads via RPC only).
alter table public.mines_rounds enable row level security;

-- Fair cash-out multiplier after k safe reveals (k=0 → 1.0, no win yet).
create or replace function public.mines_mult(p_picks int, p_mines int)
  returns numeric language plpgsql immutable as $$
declare v_m double precision := 1; v_i int;
begin
  if p_picks <= 0 then return 1.0; end if;
  for v_i in 0..(p_picks - 1) loop
    v_m := v_m * (25 - v_i)::double precision / (25 - p_mines - v_i)::double precision;
  end loop;
  return floor(0.97 * v_m * 100) / 100.0;
end; $$;

-- ---- mines_start ------------------------------------------------------------
create or replace function public.mines_start(p_stake bigint, p_mines int)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint; v_after bigint;
  v_deck int[]; v_i int; v_j int; v_tmp int; v_mines int[];
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;
  if p_mines is null or p_mines < 1 or p_mines > 24 then
    raise exception 'invalid mines' using errcode = 'check_violation';
  end if;

  delete from public.mines_rounds where user_id = v_uid;  -- abandon = loss

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'mines', -p_stake, v_after, 'mines');
  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;

  -- Shuffle [0..24] (Fisher–Yates, 1-indexed arrays) and take the first N as mines.
  v_deck := array(select generate_series(0, 24));
  for v_i in reverse 25..2 loop
    v_j := public.csprng_below(v_i);  -- 0..i-1
    v_tmp := v_deck[v_i]; v_deck[v_i] := v_deck[v_j + 1]; v_deck[v_j + 1] := v_tmp;
  end loop;
  v_mines := v_deck[1:p_mines];

  insert into public.mines_rounds (user_id, stake, mines, mine_cells) values (v_uid, p_stake, p_mines, v_mines);

  return jsonb_build_object('mines', p_mines, 'picks', '[]'::jsonb,
    'multiplier', 1.0, 'next_multiplier', public.mines_mult(1, p_mines), 'balance', v_after);
end; $$;
revoke all on function public.mines_start(bigint, int) from public;
grant execute on function public.mines_start(bigint, int) to authenticated;

-- ---- mines_pick -------------------------------------------------------------
create or replace function public.mines_pick(p_cell int)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.mines_rounds;
  v_k int; v_safe int; v_mult numeric; v_payout bigint; v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_cell is null or p_cell < 0 or p_cell > 24 then raise exception 'invalid cell' using errcode = 'check_violation'; end if;
  select * into v_r from public.mines_rounds where user_id = v_uid for update;
  if not found then raise exception 'no round' using errcode = 'check_violation'; end if;
  if p_cell = any (v_r.picks) then raise exception 'already picked' using errcode = 'check_violation'; end if;

  if p_cell = any (v_r.mine_cells) then
    -- Boom. Settle the loss and reveal the layout.
    delete from public.mines_rounds where user_id = v_uid;
    insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
    values (v_uid, 'mines', v_r.stake, 0,
            jsonb_build_object('hit', p_cell, 'mines', to_jsonb(v_r.mine_cells)),
            jsonb_build_object('reveals', coalesce(array_length(v_r.picks, 1), 0)));
    return jsonb_build_object('safe', false, 'cell', p_cell, 'mines', to_jsonb(v_r.mine_cells), 'payout', 0);
  end if;

  v_r.picks := v_r.picks || p_cell;
  v_k := array_length(v_r.picks, 1);
  v_safe := 25 - v_r.mines;
  v_mult := public.mines_mult(v_k, v_r.mines);

  if v_k >= v_safe then
    -- All safe tiles revealed → auto cash-out at the max.
    v_payout := floor(v_r.stake * v_mult);
    delete from public.mines_rounds where user_id = v_uid;
    select balance into v_balance from public.profiles where id = v_uid for update;
    v_after := v_balance + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'mines', v_payout, v_after, format('mines %sx', v_mult));
    update public.profiles set balance = v_after, total_won = total_won + v_payout,
           games_won = games_won + 1, biggest_win = greatest(biggest_win, v_payout) where id = v_uid;
    insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
    values (v_uid, 'mines', v_r.stake, v_payout,
            jsonb_build_object('cleared', true, 'mines', to_jsonb(v_r.mine_cells)),
            jsonb_build_object('multiplier', v_mult));
    return jsonb_build_object('safe', true, 'cell', p_cell, 'picks', to_jsonb(v_r.picks),
      'multiplier', v_mult, 'cashed', true, 'payout', v_payout, 'mines', to_jsonb(v_r.mine_cells), 'balance', v_after);
  end if;

  update public.mines_rounds set picks = v_r.picks where user_id = v_uid;
  return jsonb_build_object('safe', true, 'cell', p_cell, 'picks', to_jsonb(v_r.picks),
    'multiplier', v_mult, 'next_multiplier', public.mines_mult(v_k + 1, v_r.mines), 'cashed', false);
end; $$;
revoke all on function public.mines_pick(int) from public;
grant execute on function public.mines_pick(int) to authenticated;

-- ---- mines_cashout ----------------------------------------------------------
create or replace function public.mines_cashout()
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_r public.mines_rounds;
  v_k int; v_mult numeric; v_payout bigint; v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_r from public.mines_rounds where user_id = v_uid for update;
  if not found then raise exception 'no round' using errcode = 'check_violation'; end if;
  v_k := coalesce(array_length(v_r.picks, 1), 0);
  if v_k = 0 then raise exception 'revela pelo menos uma casa' using errcode = 'check_violation'; end if;

  v_mult := public.mines_mult(v_k, v_r.mines);
  v_payout := floor(v_r.stake * v_mult);
  delete from public.mines_rounds where user_id = v_uid;

  select balance into v_balance from public.profiles where id = v_uid for update;
  v_after := v_balance + v_payout;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'win', 'mines', v_payout, v_after, format('mines %sx', v_mult));
  update public.profiles set balance = v_after, total_won = total_won + v_payout,
         games_won = games_won + 1, biggest_win = greatest(biggest_win, v_payout) where id = v_uid;
  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
  values (v_uid, 'mines', v_r.stake, v_payout,
          jsonb_build_object('cashed', true, 'mines', to_jsonb(v_r.mine_cells)),
          jsonb_build_object('multiplier', v_mult, 'reveals', v_k));
  return jsonb_build_object('payout', v_payout, 'multiplier', v_mult, 'picks', to_jsonb(v_r.picks),
    'mines', to_jsonb(v_r.mine_cells), 'balance', v_after);
end; $$;
revoke all on function public.mines_cashout() from public;
grant execute on function public.mines_cashout() to authenticated;
