-- Crash: thin out the very-early busts (player feedback: "rebenta demasiadas
-- vezes nos 1.0x").
--
-- The crash point is k/(1-u): with k = 1.0 (fair) ~9% of rounds still bust below
-- 1.10x and ~17% below 1.20x, which feels punishing. We CANNOT raise k above 1.0
-- (a floor > 1.0 lets a player auto-cash just under it for guaranteed profit), so
-- instead we reshape the uniform u itself before the transform:
--
--     u' = u ^ 0.8   (u in [0,1))  →  crash = 1 / (1 - u')
--
-- Raising u to a power < 1 pushes it toward 1, so the crash point lands higher
-- more often. The floor is unchanged (u→0 ⇒ u'→0 ⇒ crash→1.0), so there is still
-- a non-zero chance of busting just above 1.00x — no guaranteed-win exploit. The
-- net effect: sub-1.10x busts roughly halve (~9%→~5%), sub-1.20x drop (~17%→~11%).
-- The game becomes slightly player-favourable on average, which is intentional for
-- this play-money friends' room. Everything else (timings, fly seconds, settle) is
-- copied verbatim from 20260622200000_crash_rooms.sql.
create or replace function public.crash_advance()
  returns public.crash_rooms
  language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_room public.crash_rooms;
  v_now  timestamptz := now();
  v_u    double precision;
  v_crash numeric;
  v_fly_secs double precision;
begin
  perform pg_advisory_xact_lock(hashtext('crash_room'));
  select * into v_room from public.crash_rooms order by id desc limit 1;

  if found then
    -- betting → flying once the window closes.
    if v_room.status = 'betting' and v_now >= v_room.betting_ends_at then
      update public.crash_rooms set status = 'flying' where id = v_room.id;
      v_room.status := 'flying';
    end if;
    -- flying → busted (+ settle) once the bust time passes.
    if v_room.status = 'flying' and v_now >= v_room.bust_at then
      update public.crash_rooms set status = 'busted', ended_at = v_room.bust_at where id = v_room.id;
      v_room.status := 'busted'; v_room.ended_at := v_room.bust_at;
      perform public.crash_settle_room(v_room.id);
    end if;
  end if;

  -- Spawn a fresh round if there is none, or the last one finished its cooldown.
  if not found or (v_room.status = 'busted' and v_now >= v_room.bust_at + interval '5 seconds') then
    v_u := power(public.csprng_unit(), 0.8::double precision);  -- bias the draw upward; floor stays 1.0
    v_crash := least(1000.0, 1.0 / (1.0 - v_u));
    if v_crash < 1.0 then v_crash := 1.0; end if;
    v_crash := floor(v_crash * 100) / 100.0;
    v_fly_secs := ln(greatest(v_crash, 1.0001)::double precision) / 0.15;  -- k matches crash_mult
    insert into public.crash_rooms (status, crash_point, betting_ends_at, fly_start_at, bust_at)
    values ('betting', v_crash,
            v_now + interval '6 seconds',
            v_now + interval '6 seconds',
            v_now + interval '6 seconds' + make_interval(secs => v_fly_secs))
    returning * into v_room;
  end if;

  return v_room;
end; $$;
revoke all on function public.crash_advance() from public;
