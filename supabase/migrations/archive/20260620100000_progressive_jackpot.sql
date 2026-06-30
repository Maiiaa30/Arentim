-- ============================================================================
-- Arentim — progressive-jackpot slot machine ("Pote de Ouro").
--
-- Unlike the other machines (fixed, hidden jackpot multiplier), a *progressive*
-- machine has a shared jackpot POOL that grows: a slice of every stake played on
-- it feeds the pool, so it climbs as players lose money on the machine. When the
-- jackpot symbol lands three-up, the player wins the WHOLE pool and it resets to
-- its seed. The pool value is public (it's the whole appeal) — list_slot_machines
-- exposes it for progressive machines while still masking the fixed ones.
-- ============================================================================

alter table public.slot_machines add column if not exists progressive  boolean not null default false;
alter table public.slot_machines add column if not exists jackpot_pool  bigint  not null default 0;
alter table public.slot_machines add column if not exists jackpot_seed  bigint  not null default 0;

-- ---- The progressive machine -----------------------------------------------
insert into public.slot_machines
  (key, name, blurb, accent, min_bet, max_bet, sort, jackpot_symbol, symbols, strip, pay3, pay2,
   progressive, jackpot_seed, jackpot_pool)
values
  ('pote', 'Pote de Ouro', 'Jackpot progressivo — cada jogada engorda o pote até alguém o levar todo.', 'gold',
    10, 1000, 0, 'pote',
    '[{"id":"pote","glyph":"🏆"},{"id":"seven","glyph":"7️⃣"},{"id":"star","glyph":"⭐"},{"id":"clover","glyph":"🍀"},{"id":"coin","glyph":"🪙"}]',
    '["coin","coin","coin","coin","coin","coin","coin","coin","coin","coin","coin","coin","coin","coin","clover","clover","clover","clover","clover","clover","clover","clover","clover","star","star","star","star","star","star","seven","seven","seven","pote"]',
    '{"coin":4,"clover":10,"star":25,"seven":90,"pote":0}',
    '{"coin":2}',
    true, 5000, 5000)
on conflict (key) do update set
  name = excluded.name, blurb = excluded.blurb, accent = excluded.accent,
  min_bet = excluded.min_bet, max_bet = excluded.max_bet, sort = excluded.sort,
  jackpot_symbol = excluded.jackpot_symbol, symbols = excluded.symbols,
  strip = excluded.strip, pay3 = excluded.pay3, pay2 = excluded.pay2,
  progressive = excluded.progressive, jackpot_seed = excluded.jackpot_seed;

-- ---- list_slot_machines() — now also surfaces the live progressive pool -----
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
  ) q;
$$;
revoke all on function public.list_slot_machines() from public;
grant execute on function public.list_slot_machines() to authenticated;

-- ---- play_slot — progressive-aware ------------------------------------------
-- A slice (10%) of every stake on a progressive machine feeds its pool. The
-- jackpot symbol three-up wins the whole pool (and resets it to the seed);
-- other wins pay their normal multiplier as before. Fixed machines are unchanged.
create or replace function public.play_slot(
  p_machine text,
  p_stake bigint,
  p_idempotency_key text default null
)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  v_uid      uuid := auth.uid();
  v_m        public.slot_machines;
  v_len      integer;
  v_balance  bigint;
  v_after    bigint;
  v_s1 text; v_s2 text; v_s3 text;
  v_mult     integer := 0;
  v_pair     text;
  v_jackpot  boolean := false;
  v_payout   bigint := 0;
  v_pool     bigint := null;
  v_existing public.game_rounds;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_m from public.slot_machines where key = p_machine;
  if not found then
    raise exception 'unknown machine' using errcode = 'check_violation';
  end if;

  if p_stake is null or p_stake < v_m.min_bet or p_stake > v_m.max_bet then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'reels', v_existing.outcome -> 'reels',
        'machine', v_existing.outcome ->> 'machine',
        'multiplier', (v_existing.detail ->> 'multiplier')::int,
        'jackpot', coalesce((v_existing.detail ->> 'jackpot')::boolean, false),
        'payout', v_existing.payout,
        'jackpot_pool', (v_existing.detail ->> 'jackpot_pool')::bigint,
        'balance', (select balance from public.profiles where id = v_uid),
        'replayed', true
      );
    end if;
  end if;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then
    raise exception 'insufficient balance' using errcode = 'check_violation';
  end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'slots', -p_stake, v_after, format('slots %s', v_m.key));

  -- Progressive: lock the machine row and feed a slice of the stake into the pool.
  if v_m.progressive then
    update public.slot_machines
       set jackpot_pool = jackpot_pool + greatest(1, (p_stake / 10))
     where key = p_machine
     returning jackpot_pool into v_pool;
  end if;

  v_len := jsonb_array_length(v_m.strip);
  v_s1 := v_m.strip ->> public.csprng_below(v_len);
  v_s2 := v_m.strip ->> public.csprng_below(v_len);
  v_s3 := v_m.strip ->> public.csprng_below(v_len);

  if v_s1 = v_s2 and v_s2 = v_s3 then
    v_jackpot := (v_s1 = v_m.jackpot_symbol);
    if v_jackpot and v_m.progressive then
      -- Win the whole pool, then reset it to the seed.
      v_payout := v_pool;
      update public.slot_machines set jackpot_pool = jackpot_seed
       where key = p_machine returning jackpot_pool into v_pool;
    else
      v_mult := coalesce((v_m.pay3 ->> v_s1)::int, 0);
      v_payout := p_stake * v_mult;
    end if;
  else
    if v_s1 = v_s2 or v_s1 = v_s3 then v_pair := v_s1;
    elsif v_s2 = v_s3 then v_pair := v_s2;
    end if;
    if v_pair is not null then
      v_mult := coalesce((v_m.pay2 ->> v_pair)::int, 0);
      v_payout := p_stake * v_mult;
    end if;
  end if;

  if v_payout > 0 then
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'slots', v_payout, v_after,
            format('slots %s %s-%s-%s%s', v_m.key, v_s1, v_s2, v_s3,
                   case when v_jackpot then ' JACKPOT' else '' end));
  end if;

  update public.profiles
     set balance        = v_after,
         total_wagered    = total_wagered + p_stake,
         total_won        = total_won + v_payout,
         total_lost       = total_lost + p_stake,
         biggest_win      = greatest(biggest_win, v_payout),
         games_played     = games_played + 1,
         games_won        = games_won + (case when v_payout > 0 then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'slots', p_stake, v_payout,
          jsonb_build_object('reels', jsonb_build_array(v_s1, v_s2, v_s3), 'machine', v_m.key),
          jsonb_build_object('multiplier', v_mult, 'jackpot', v_jackpot, 'jackpot_pool', v_pool),
          p_idempotency_key);

  return jsonb_build_object(
    'reels', jsonb_build_array(v_s1, v_s2, v_s3),
    'machine', v_m.key,
    'multiplier', v_mult,
    'jackpot', v_jackpot,
    'payout', v_payout,
    'jackpot_pool', v_pool,
    'balance', v_after,
    'replayed', false
  );
end;
$$;
revoke all on function public.play_slot(text, bigint, text) from public;
grant execute on function public.play_slot(text, bigint, text) to authenticated;
