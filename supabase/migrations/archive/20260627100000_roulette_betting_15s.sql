-- Roulette: lengthen the betting window from 12s to 15s (player feedback — too
-- little time to place chips). Only the round-spawn timings change; the rest of
-- roulette_advance() is copied verbatim from 20260622300000_roulette_rooms.sql
-- (it has not been redefined since). Spin (5s) and post-reveal cooldown (6s) are
-- unchanged.
create or replace function public.roulette_advance()
  returns public.roulette_rooms
  language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_room public.roulette_rooms;
  v_now  timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtext('roulette_room'));
  select * into v_room from public.roulette_rooms order by id desc limit 1;

  if found then
    -- Settle + close when the reveal time passes.
    if v_room.status <> 'done' and v_now >= v_room.reveal_at then
      update public.roulette_rooms set status = 'done', ended_at = v_room.reveal_at where id = v_room.id;
      v_room.status := 'done'; v_room.ended_at := v_room.reveal_at;
      perform public.roulette_settle_room(v_room.id);
    elsif v_room.status = 'betting' and v_now >= v_room.betting_ends_at then
      update public.roulette_rooms set status = 'spinning' where id = v_room.id;
      v_room.status := 'spinning';
    end if;
  end if;

  -- Spawn a fresh round if none, or the last one finished its cooldown.
  if not found or (v_room.status = 'done' and v_now >= v_room.reveal_at + interval '6 seconds') then
    insert into public.roulette_rooms (status, result_number, betting_ends_at, spin_start_at, reveal_at)
    values ('betting', public.spin_roulette(),
            v_now + interval '15 seconds',
            v_now + interval '15 seconds',
            v_now + interval '15 seconds' + interval '5 seconds')
    returning * into v_room;
  end if;

  return v_room;
end; $$;
revoke all on function public.roulette_advance() from public;
