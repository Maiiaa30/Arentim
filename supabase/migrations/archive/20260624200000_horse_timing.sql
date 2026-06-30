-- ============================================================================
-- Arentim — give horse races a longer betting window so the table doesn't feel
-- like it's "always waiting": betting 18s → racing 6s → cooldown 5s.
-- (Redefines horse_advance only; everything else is unchanged.)
-- ============================================================================

create or replace function public.horse_advance()
  returns public.horse_rooms language plpgsql volatile security definer
  set search_path = public, extensions
as $$
declare
  v_room public.horse_rooms; v_now timestamptz := now();
  v_weights int[] := array[4167, 2500, 1667, 1111, 714, 357]; v_total int := 10516;
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
    v_r := public.csprng_below(v_total);
    for v_i in 1..6 loop
      v_acc := v_acc + v_weights[v_i];
      if v_r < v_acc then v_winner := v_i - 1; exit; end if;
    end loop;
    insert into public.horse_rooms (status, winner, betting_ends_at, race_start_at, finish_at)
    values ('betting', v_winner,
            v_now + interval '18 seconds',
            v_now + interval '18 seconds',
            v_now + interval '18 seconds' + interval '6 seconds')
    returning * into v_room;
  end if;

  return v_room;
end; $$;
revoke all on function public.horse_advance() from public;
