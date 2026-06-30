-- ============================================================================
-- Arentim — include Corrida de Cavalos in the lobby live-activity feed.
-- Adds a `horse` block (current race player count + friends) to casino_activity.
-- ============================================================================

create or replace function public.casino_activity()
  returns jsonb language plpgsql stable security definer
  set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_friends uuid[];
  v_crash_room bigint; v_roul_room bigint; v_horse_room bigint;
  v_crash_players int := 0; v_crash_friends int := 0;
  v_roul_players int := 0; v_roul_friends int := 0;
  v_horse_players int := 0; v_horse_friends int := 0;
  v_recent jsonb;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  select coalesce(array_agg(case when requester = v_uid then addressee else requester end), '{}')
    into v_friends
    from public.friendships
   where status = 'accepted' and (requester = v_uid or addressee = v_uid);

  select id into v_crash_room from public.crash_rooms where status in ('betting', 'flying') order by id desc limit 1;
  if v_crash_room is not null then
    select count(*), count(*) filter (where user_id = any (v_friends))
      into v_crash_players, v_crash_friends from public.crash_bets where room_id = v_crash_room;
  end if;

  select id into v_roul_room from public.roulette_rooms where status in ('betting', 'spinning') order by id desc limit 1;
  if v_roul_room is not null then
    select count(*), count(*) filter (where user_id = any (v_friends))
      into v_roul_players, v_roul_friends from public.roulette_room_bets where room_id = v_roul_room;
  end if;

  -- Current live horse race (taking bets or running).
  select id into v_horse_room from public.horse_rooms where status in ('betting', 'racing') order by id desc limit 1;
  if v_horse_room is not null then
    select count(*), count(*) filter (where user_id = any (v_friends))
      into v_horse_players, v_horse_friends from public.horse_bets where room_id = v_horse_room;
  end if;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_recent from (
    select jsonb_build_object('name', p.display_name, 'game', t.game, 'amount', t.amount, 'at', t.created_at, 'is_me', t.user_id = v_uid) as x
      from public.transactions t
      join public.profiles p on p.id = t.user_id
     where t.type = 'win' and t.amount >= 1000 and (t.user_id = v_uid or t.user_id = any (v_friends))
     order by t.created_at desc limit 6
  ) q;

  return jsonb_build_object(
    'crash', jsonb_build_object('players', v_crash_players, 'friends', v_crash_friends),
    'roulette', jsonb_build_object('players', v_roul_players, 'friends', v_roul_friends),
    'horse', jsonb_build_object('players', v_horse_players, 'friends', v_horse_friends),
    'recent', v_recent
  );
end; $$;
revoke all on function public.casino_activity() from public;
grant execute on function public.casino_activity() to authenticated;
