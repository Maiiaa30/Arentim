-- ============================================================================
-- Arentim — Baú do Tesouro as a true cup-and-ball game. cups_start shows where
-- the ball goes and returns the exact swap sequence the cups perform (the client
-- animates it honestly); cups_pick settles whether the cup you chose is the one
-- holding the ball. A correct pick pays 2.85× (RTP ≈ 0.95). The shuffle is fast
-- enough that tracking is hard — that's the house edge.
-- ============================================================================

drop function if exists public.play_chest(bigint, int, text);

create table if not exists public.cups_rounds (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  prize      int not null check (prize between 0 and 2),
  stake      bigint not null check (stake > 0),
  created_at timestamptz not null default now()
);
alter table public.cups_rounds enable row level security;
drop policy if exists cups_rounds_select_own on public.cups_rounds;
create policy cups_rounds_select_own on public.cups_rounds
  for select to authenticated using (user_id = auth.uid());

-- ---- cups_start -------------------------------------------------------------
create or replace function public.cups_start(p_stake bigint)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint; v_after bigint;
  v_start int; v_ball int; v_a int; v_b int; v_k int;
  v_swaps jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  -- Abandoned round = a loss (stake already taken); overwrite below.
  delete from public.cups_rounds where user_id = v_uid;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'chest', -p_stake, v_after, 'copos');

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_lost = total_lost + p_stake,
         games_played = games_played + 1, last_played_date = current_date
   where id = v_uid;

  -- The ball starts under a random cup; build a swap sequence and track where it
  -- ends. Each swap exchanges the cups at two distinct positions.
  v_start := public.csprng_below(3);
  v_ball := v_start;
  for v_k in 1..6 loop
    v_a := public.csprng_below(3);
    v_b := (v_a + 1 + public.csprng_below(2)) % 3;
    v_swaps := v_swaps || jsonb_build_array(jsonb_build_array(v_a, v_b));
    if    v_ball = v_a then v_ball := v_b;
    elsif v_ball = v_b then v_ball := v_a;
    end if;
  end loop;

  insert into public.cups_rounds (user_id, prize, stake) values (v_uid, v_ball, p_stake);

  return jsonb_build_object('start', v_start, 'swaps', v_swaps, 'multiplier', 2.85, 'balance', v_after);
end;
$$;
revoke all on function public.cups_start(bigint) from public;
grant execute on function public.cups_start(bigint) to authenticated;

-- ---- cups_pick --------------------------------------------------------------
create or replace function public.cups_pick(p_picked int)
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_prize int; v_stake bigint; v_win boolean; v_payout bigint := 0; v_mult numeric := 2.85;
  v_balance bigint; v_after bigint;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_picked is null or p_picked < 0 or p_picked > 2 then raise exception 'invalid pick' using errcode = 'check_violation'; end if;

  delete from public.cups_rounds where user_id = v_uid returning prize, stake into v_prize, v_stake;
  if v_prize is null then raise exception 'no round to pick' using errcode = 'check_violation'; end if;

  v_win := (p_picked = v_prize);
  v_payout := case when v_win then floor(v_stake * v_mult) else 0 end;

  select balance into v_balance from public.profiles where id = v_uid for update;
  v_after := v_balance;
  if v_payout > 0 then
    v_after := v_balance + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'chest', v_payout, v_after, 'copos — encontrou');
    update public.profiles
       set balance = v_after, total_won = total_won + v_payout, games_won = games_won + 1,
           biggest_win = greatest(biggest_win, v_payout)
     where id = v_uid;
  end if;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
  values (v_uid, 'chest', v_stake, v_payout,
          jsonb_build_object('picked', p_picked, 'prize', v_prize),
          jsonb_build_object('multiplier', v_mult));

  return jsonb_build_object('prize', v_prize, 'picked', p_picked, 'won', v_win,
                            'multiplier', v_mult, 'payout', v_payout, 'balance', v_after);
end;
$$;
revoke all on function public.cups_pick(int) from public;
grant execute on function public.cups_pick(int) to authenticated;
