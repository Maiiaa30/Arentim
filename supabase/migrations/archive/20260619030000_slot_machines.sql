-- ============================================================================
-- Arentim — Slots floor: multiple themed machines, each with a hidden jackpot.
--
-- A real-casino-style slots lobby. Each machine is a config row: its own reel
-- strip (symbol weights), paytable, and a rare jackpot symbol whose three-of-a-
-- kind pays the machine's top prize. The jackpot multiplier is NEVER sent to the
-- client (list_slot_machines masks it) — players know a jackpot exists, not how
-- big or how likely. Aurélia carries the biggest jackpot of all.
--
-- Server-authoritative, same atomic pattern as play_slots: validate → lock →
-- debit → roll (CSPRNG) → credit → record, in one transaction, idempotent.
-- RTP per machine is ~0.86–0.93 (house edge 7–14%); verified against the TS
-- mirror in src/features/casino/slotMachines.test.ts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Config table. Clients never read it directly (strip + jackpot are secret);
-- they get a sanitized list from list_slot_machines(). Admins may audit.
-- ----------------------------------------------------------------------------
create table if not exists public.slot_machines (
  key             text primary key,
  name            text   not null,
  blurb           text   not null,
  accent          text   not null default 'gold',   -- UI accent token
  min_bet         bigint not null check (min_bet > 0),
  max_bet         bigint not null check (max_bet >= min_bet),
  symbols         jsonb  not null,   -- [{id, glyph}] display order (high→low)
  strip           jsonb  not null,   -- [symbolId, …] weighted reel (len ≤ 64)
  pay3            jsonb  not null,   -- {symbolId: multiplier} three-of-a-kind
  pay2            jsonb  not null default '{}',  -- {symbolId: multiplier} pair
  jackpot_symbol  text   not null,   -- its pay3 entry is the (hidden) jackpot
  sort            int    not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.slot_machines enable row level security;
-- Default deny; the SECURITY DEFINER functions below are the only readers.
drop policy if exists slot_machines_admin_select on public.slot_machines;
create policy slot_machines_admin_select on public.slot_machines
  for select to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Seed the five opening machines. Reel strips encode the weights (a symbol that
-- appears N times in the strip lands with probability N / strip-length).
-- ----------------------------------------------------------------------------
insert into public.slot_machines
  (key, name, blurb, accent, min_bet, max_bet, sort, jackpot_symbol, symbols, strip, pay3, pay2)
values
  ('classico', 'Clássico', 'Cerejas, sinos e o sete da sorte. Prémios frequentes.', 'gold',
    5, 100, 1, 'seven',
    '[{"id":"seven","glyph":"7️⃣"},{"id":"star","glyph":"⭐"},{"id":"bell","glyph":"🔔"},{"id":"lemon","glyph":"🍋"},{"id":"cherry","glyph":"🍒"}]',
    '["cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","lemon","lemon","lemon","lemon","lemon","lemon","lemon","lemon","lemon","bell","bell","bell","bell","bell","star","star","star","star","seven","seven"]',
    '{"cherry":5,"lemon":8,"bell":18,"star":45,"seven":150}',
    '{"cherry":1}'),

  ('frutaria', 'Frutaria', 'Fruta madura a cair. Muitos prémios pequenos, jackpot raro.', 'positive-felt',
    5, 150, 2, 'gem',
    '[{"id":"gem","glyph":"💎"},{"id":"bell","glyph":"🔔"},{"id":"straw","glyph":"🍓"},{"id":"orange","glyph":"🍊"},{"id":"grape","glyph":"🍇"},{"id":"melon","glyph":"🍉"}]',
    '["melon","melon","melon","melon","melon","melon","melon","melon","melon","melon","melon","melon","grape","grape","grape","grape","grape","grape","grape","grape","grape","orange","orange","orange","orange","orange","orange","orange","straw","straw","straw","straw","straw","bell","bell","gem"]',
    '{"melon":5,"grape":9,"orange":16,"straw":30,"bell":90,"gem":350}',
    '{"melon":1,"grape":1}'),

  ('tasca', 'Tasca do Galo', 'Sardinha, vinho e o galo de Barcelos. Bem português.', 'chip-ruby',
    10, 200, 3, 'coin',
    '[{"id":"coin","glyph":"🪙"},{"id":"galo","glyph":"🐓"},{"id":"wine","glyph":"🍷"},{"id":"olive","glyph":"🫒"},{"id":"sardine","glyph":"🐟"}]',
    '["sardine","sardine","sardine","sardine","sardine","sardine","sardine","sardine","sardine","sardine","sardine","sardine","sardine","olive","olive","olive","olive","olive","olive","olive","olive","olive","wine","wine","wine","wine","wine","galo","galo","galo","galo","coin"]',
    '{"sardine":6,"olive":12,"wine":24,"galo":40,"coin":300}',
    '{"coin":3,"galo":1}'),

  ('pirata', 'Tesouro Pirata', 'Alta volatilidade. Poucos prémios, mas que valem a pena.', 'chip-navy',
    10, 250, 4, 'skull',
    '[{"id":"skull","glyph":"💀"},{"id":"chest","glyph":"🧰"},{"id":"map","glyph":"🗺️"},{"id":"anchor","glyph":"⚓"},{"id":"parrot","glyph":"🦜"}]',
    '["parrot","parrot","parrot","parrot","parrot","parrot","parrot","parrot","parrot","parrot","parrot","parrot","parrot","parrot","parrot","parrot","parrot","parrot","anchor","anchor","anchor","anchor","anchor","anchor","anchor","anchor","anchor","anchor","anchor","anchor","map","map","map","map","map","map","chest","chest","chest","skull"]',
    '{"parrot":3,"anchor":14,"map":45,"chest":180,"skull":800}',
    '{}'),

  ('aurelia', 'Aurélia Royal', 'A casa de elite. O maior jackpot do Arentim — e o mais difícil.', 'gold',
    25, 250, 5, 'crown',
    '[{"id":"crown","glyph":"👑"},{"id":"seven","glyph":"7️⃣"},{"id":"star","glyph":"⭐"},{"id":"bell","glyph":"🔔"},{"id":"ruby","glyph":"♦️"}]',
    '["ruby","ruby","ruby","ruby","ruby","ruby","ruby","ruby","ruby","ruby","ruby","ruby","ruby","ruby","ruby","ruby","ruby","ruby","bell","bell","bell","bell","bell","bell","bell","bell","bell","bell","bell","bell","star","star","star","star","star","star","seven","seven","seven","crown"]',
    '{"ruby":3,"bell":13,"star":45,"seven":150,"crown":1500}',
    '{}')
on conflict (key) do update set
  name = excluded.name, blurb = excluded.blurb, accent = excluded.accent,
  min_bet = excluded.min_bet, max_bet = excluded.max_bet, sort = excluded.sort,
  jackpot_symbol = excluded.jackpot_symbol, symbols = excluded.symbols,
  strip = excluded.strip, pay3 = excluded.pay3, pay2 = excluded.pay2;

-- ----------------------------------------------------------------------------
-- list_slot_machines() — sanitized lobby data. Returns each machine's symbols
-- and a paytable, but the jackpot symbol's multiplier is masked to null so the
-- top prize stays a mystery. Never exposes the reel strip.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- play_slot(machine, stake, idem) — one spin on a chosen machine.
-- ----------------------------------------------------------------------------
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

  -- Idempotency: replay returns the original spin.
  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'reels', v_existing.outcome -> 'reels',
        'machine', v_existing.outcome ->> 'machine',
        'multiplier', (v_existing.detail ->> 'multiplier')::int,
        'jackpot', coalesce((v_existing.detail ->> 'jackpot')::boolean, false),
        'payout', v_existing.payout,
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

  -- Spin: pick one strip position per reel with the CSPRNG.
  v_len := jsonb_array_length(v_m.strip);
  v_s1 := v_m.strip ->> public.csprng_below(v_len);
  v_s2 := v_m.strip ->> public.csprng_below(v_len);
  v_s3 := v_m.strip ->> public.csprng_below(v_len);

  -- Multiplier: three-of-a-kind, else a paying pair, else nothing.
  if v_s1 = v_s2 and v_s2 = v_s3 then
    v_mult := coalesce((v_m.pay3 ->> v_s1)::int, 0);
    v_jackpot := (v_s1 = v_m.jackpot_symbol);
  else
    if v_s1 = v_s2 or v_s1 = v_s3 then v_pair := v_s1;
    elsif v_s2 = v_s3 then v_pair := v_s2;
    end if;
    if v_pair is not null then
      v_mult := coalesce((v_m.pay2 ->> v_pair)::int, 0);
    end if;
  end if;

  v_payout := p_stake * v_mult;

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
          jsonb_build_object('multiplier', v_mult, 'jackpot', v_jackpot), p_idempotency_key);

  return jsonb_build_object(
    'reels', jsonb_build_array(v_s1, v_s2, v_s3),
    'machine', v_m.key,
    'multiplier', v_mult,
    'jackpot', v_jackpot,
    'payout', v_payout,
    'balance', v_after,
    'replayed', false
  );
end;
$$;

revoke all on function public.play_slot(text, bigint, text) from public;
grant execute on function public.play_slot(text, bigint, text) to authenticated;
