-- ============================================================================
-- Arentim — Slots: a `cabinet` style flag + a new CLASSIC 3-reel machine.
--
-- The slots floor now renders two cabinet styles: 'video' (the ornate themed
-- cabinets) and 'classic' (a chrome-and-gold 3-reel drum with a side lever, like
-- an old Vegas one-armed bandit). The flag is purely cosmetic — the 3-reel
-- mechanic and the play_slot RPC are unchanged.
--
-- New machine "Vegas 777" (cabinet = classic): the timeless cherry / BAR /
-- double-BAR / triple-BAR / bell / lucky-7 set. Three 7s is the (hidden) jackpot.
--   strip L=40: cherry14 bell10 bar6 barbar4 barbarbar4 seven2
--   pay3: cherry4 bell12 bar25 barbar60 barbarbar120 seven250 ; pay2: cherry1
--   → RTP ≈ 0.894, jackpot (three 7s) ≈ 1/8000. Mirrored in slotMachines.test.ts.
-- ============================================================================

alter table public.slot_machines
  add column if not exists cabinet text not null default 'video';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'slot_machines_cabinet_chk') then
    alter table public.slot_machines
      add constraint slot_machines_cabinet_chk check (cabinet in ('video', 'classic'));
  end if;
end $$;

-- ---- the new classic machine -------------------------------------------------
insert into public.slot_machines
  (key, name, blurb, accent, cabinet, min_bet, max_bet, sort, jackpot_symbol, symbols, strip, pay3, pay2)
values
  ('vegas', 'Vegas 777', 'A clássica de Las Vegas: cerejas, BAR e o sete da sorte. Três setes = jackpot.',
    'gold', 'classic', 5, 200, 6, 'seven',
    '[{"id":"seven","glyph":"7️⃣"},{"id":"barbarbar","glyph":"≣"},{"id":"barbar","glyph":"⩵"},{"id":"bar","glyph":"▬"},{"id":"bell","glyph":"🔔"},{"id":"cherry","glyph":"🍒"}]',
    '["cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","cherry","bell","bell","bell","bell","bell","bell","bell","bell","bell","bell","bar","bar","bar","bar","bar","bar","barbar","barbar","barbar","barbar","barbarbar","barbarbar","barbarbar","barbarbar","seven","seven"]',
    '{"cherry":4,"bell":12,"bar":25,"barbar":60,"barbarbar":120,"seven":250}',
    '{"cherry":1}')
on conflict (key) do update set
  name = excluded.name, blurb = excluded.blurb, accent = excluded.accent,
  cabinet = excluded.cabinet, min_bet = excluded.min_bet, max_bet = excluded.max_bet,
  sort = excluded.sort, jackpot_symbol = excluded.jackpot_symbol, symbols = excluded.symbols,
  strip = excluded.strip, pay3 = excluded.pay3, pay2 = excluded.pay2;

-- ---- list_slot_machines() — keeps the progressive pool, adds the cabinet style
-- (rebased on the progressive-aware version from 20260620100000 so the Pote de
-- Ouro pool keeps showing — this later create-or-replace must not drop it).
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
      'cabinet', m.cabinet,
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
