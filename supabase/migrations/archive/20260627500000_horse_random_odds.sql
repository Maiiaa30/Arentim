-- Horse race: randomize each horse's win chance (and therefore its odds) EVERY
-- round, so the favourite changes instead of always being horse #1.
--
-- Each round draws 6 fresh random weights; odds are derived as
--   odds[i] = round(total * 0.94 / weight[i], 2)   (min 1.20)
-- which keeps a uniform ~0.94 RTP on every horse (payout stays fair). The winner
-- is drawn weighted by those same weights, and the odds are STORED on the room so
-- the snapshot + settlement use the exact odds the player saw when betting.
alter table public.horse_rooms add column if not exists odds jsonb;

-- Settle bets using the ROUND'S stored odds (fallback to the old fixed set for any
-- pre-existing rows).
create or replace function public.horse_settle_room(p_room_id bigint)
  returns void language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_odds numeric[]; v_odds_json jsonb;
  v_winner int; v_bet public.horse_bets; v_payout bigint; v_after bigint;
begin
  select winner, odds into v_winner, v_odds_json from public.horse_rooms where id = p_room_id;
  if v_winner is null then return; end if;
  v_odds := coalesce(
    (select array_agg(e::numeric order by ord)
       from jsonb_array_elements_text(coalesce(v_odds_json, '[]'::jsonb)) with ordinality as t(e, ord)),
    array[2.4, 4, 6, 9, 14, 28]);
  if array_length(v_odds, 1) is distinct from 6 then v_odds := array[2.4, 4, 6, 9, 14, 28]; end if;

  for v_bet in select * from public.horse_bets where room_id = p_room_id and not settled for update loop
    if v_bet.horse = v_winner then
      v_payout := floor(v_bet.stake * v_odds[v_bet.horse + 1]);
      update public.horse_bets set settled = true, payout = v_payout where id = v_bet.id;
      select balance into v_after from public.profiles where id = v_bet.user_id for update;
      v_after := v_after + v_payout;
      insert into public.transactions (user_id, type, game, amount, balance_after, note)
      values (v_bet.user_id, 'win', 'horse', v_payout, v_after, format('corrida — cavalo %s', v_winner + 1));
      update public.profiles set balance = v_after, total_won = total_won + v_payout,
             games_won = games_won + 1, biggest_win = greatest(biggest_win, v_payout) where id = v_bet.user_id;
    else
      update public.horse_bets set settled = true, payout = 0 where id = v_bet.id;
    end if;
    insert into public.game_rounds (user_id, game, stake, payout, outcome, detail)
    values (v_bet.user_id, 'horse', v_bet.stake, (case when v_bet.horse = v_winner then floor(v_bet.stake * v_odds[v_bet.horse + 1]) else 0 end),
            jsonb_build_object('winner', v_winner, 'horse', v_bet.horse), jsonb_build_object('odds', v_odds[v_bet.horse + 1]));
  end loop;
end; $$;
revoke all on function public.horse_settle_room(bigint) from public;

-- Advance the timeline; on a NEW round, randomize weights → odds → winner. Timings
-- match 20260624400000 (18s betting + 6s race, 5s cooldown).
create or replace function public.horse_advance()
  returns public.horse_rooms language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_room public.horse_rooms; v_now timestamptz := now();
  v_weights int[]; v_total int := 0; v_odds numeric[]; v_o numeric;
  v_r int; v_acc int := 0; v_winner int := 0; v_i int;
begin
  perform pg_advisory_xact_lock(hashtext('horse_room'));
  select * into v_room from public.horse_rooms order by id desc limit 1;

  if found then
    if v_room.status <> 'done' and v_now >= v_room.finish_at then
      update public.horse_rooms set status = 'done', ended_at = v_room.finish_at where id = v_room.id;
      v_room.status := 'done'; v_room.ended_at := v_room.finish_at;
      perform public.horse_settle_room(v_room.id);
    elsif v_room.status = 'betting' and v_now >= v_room.betting_ends_at then
      update public.horse_rooms set status = 'racing' where id = v_room.id;
      v_room.status := 'racing';
    end if;
  end if;

  if not found or (v_room.status = 'done' and v_now >= v_room.finish_at + interval '5 seconds') then
    -- Fresh random win weights so the favourite (and thus the odds) varies each round.
    v_weights := array[]::int[];
    for v_i in 1..6 loop
      v_weights := v_weights || (350 + floor(public.csprng_unit() * 4000)::int);  -- 350 .. 4349
      v_total := v_total + v_weights[v_i];
    end loop;
    -- Odds from weights with a uniform ~0.94 RTP.
    v_odds := array[]::numeric[];
    for v_i in 1..6 loop
      v_o := round((v_total::numeric * 0.94) / v_weights[v_i], 2);
      if v_o < 1.20 then v_o := 1.20; end if;
      v_odds := v_odds || v_o;
    end loop;
    -- Winner drawn by the same weights.
    v_r := floor(public.csprng_unit() * v_total)::int;
    for v_i in 1..6 loop
      v_acc := v_acc + v_weights[v_i];
      if v_r < v_acc then v_winner := v_i - 1; exit; end if;
    end loop;

    insert into public.horse_rooms (status, winner, odds, betting_ends_at, race_start_at, finish_at)
    values ('betting', v_winner, to_jsonb(v_odds),
            v_now + interval '18 seconds',
            v_now + interval '18 seconds',
            v_now + interval '18 seconds' + interval '6 seconds')
    returning * into v_room;
  end if;

  return v_room;
end; $$;
revoke all on function public.horse_advance() from public;

-- Return the round's stored odds (fallback to the legacy fixed set).
create or replace function public.horse_room_now()
  returns jsonb language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare v_room public.horse_rooms; v_uid uuid := auth.uid(); v_mine public.horse_bets;
begin
  v_room := public.horse_advance();
  if v_uid is not null then
    select * into v_mine from public.horse_bets where room_id = v_room.id and user_id = v_uid;
  end if;
  return jsonb_build_object(
    'room_id', v_room.id, 'status', v_room.status, 'server_now', now(),
    'betting_ends_at', v_room.betting_ends_at, 'race_start_at', v_room.race_start_at,
    'finish_at', v_room.finish_at,
    'odds', coalesce(v_room.odds, to_jsonb(array[2.4, 4, 6, 9, 14, 28])),
    'winner', case when v_room.status in ('racing', 'done') then v_room.winner else null end,
    'mine', case when v_mine.id is not null then jsonb_build_object('horse', v_mine.horse, 'stake', v_mine.stake, 'settled', v_mine.settled, 'payout', v_mine.payout) else null end
  );
end; $$;
revoke all on function public.horse_room_now() from public;
grant execute on function public.horse_room_now() to authenticated;
