-- ============================================================================
-- Arentim — Fortuna de Ouro: a 5-reel × 3-row, 9-payline video slot.
--
-- One fixed machine (no slot_machines row). Server-authoritative, same atomic
-- pattern as play_slot: validate → lock → debit → spin (CSPRNG per reel) →
-- evaluate → credit → record, in one transaction, idempotent via game_rounds.
--
-- A single weighted strip of length 40 (clover 9, horseshoe 7, coin 6, bell 5,
-- ruby 4, ring 3, crown 3, diamond 2, seven 1) is used on every reel. Each reel
-- shows three consecutive strip cells. For each of the 9 paylines a line pays
-- the longest left-aligned run (≥3) of the reel-0 symbol; the winning lines'
-- per-line multipliers are summed and divided by the line count, and
-- payout = floor(stake × totalMult). This normalisation makes the RTP equal to
-- a single line's expected return, independent of line count.
--
-- RTP ≈ 0.9175 (house edge ≈ 8.25%). Mirrors the JS engine + tests in
-- src/features/casino/videoSlot.ts and src/features/casino/videoSlot.test.ts —
-- keep STRIP / LINES / PAYTABLE in sync with that module.
-- ============================================================================

create or replace function public.play_video_slot(
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
  -- The shared 40-symbol reel strip (index 1..40 in PL/pgSQL arrays).
  v_strip text[] := array[
    'clover','horseshoe','coin','bell','clover',
    'ruby','horseshoe','ring','clover','coin',
    'crown','bell','horseshoe','clover','diamond',
    'coin','ruby','clover','horseshoe','bell',
    'ring','clover','coin','crown','horseshoe',
    'ruby','clover','bell','seven','coin',
    'clover','horseshoe','ring','ruby','bell',
    'diamond','clover','coin','crown','horseshoe'
  ];
  -- The 9 paylines as flat 5-element row-index arrays (0=top,1=mid,2=bottom).
  v_lines int[][] := array[
    array[1,1,1,1,1],
    array[0,0,0,0,0],
    array[2,2,2,2,2],
    array[0,1,2,1,0],
    array[2,1,0,1,2],
    array[1,0,0,0,1],
    array[1,2,2,2,1],
    array[0,0,1,2,2],
    array[2,2,1,0,0]
  ];
  -- Per-line multipliers: pay3, pay4, pay5 per symbol.
  v_pay3 jsonb := '{"seven":950,"diamond":330,"crown":165,"ring":115,"ruby":58,"bell":28,"coin":16,"horseshoe":10,"clover":5}'::jsonb;
  v_pay4 jsonb := '{"seven":7500,"diamond":2300,"crown":1020,"ring":680,"ruby":330,"bell":165,"coin":100,"horseshoe":50,"clover":30}'::jsonb;
  v_pay5 jsonb := '{"seven":65000,"diamond":14500,"crown":5200,"ring":3600,"ruby":1750,"bell":950,"coin":520,"horseshoe":300,"clover":150}'::jsonb;
  v_line_count constant int := 9;

  v_uid      uuid := auth.uid();
  v_balance  bigint;
  v_after    bigint;
  v_existing public.game_rounds;

  v_stops    int[] := '{}';          -- 5 stop indices (0-based into the strip)
  v_grid     text[][];               -- grid[reel][row], reel 1..5, row 1..3
  v_r        int;
  v_row      int;
  v_stop     int;

  v_li       int;
  v_sym      text;
  v_len      int;
  v_mult     int;
  v_sum      bigint := 0;            -- sum of winning per-line multipliers
  v_jackpot  boolean := false;
  v_lines_out jsonb := '[]'::jsonb;
  v_grid_out jsonb;
  v_reel_out jsonb;

  v_total_mult numeric;
  v_payout   bigint := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_stake is null or p_stake < 5 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  -- Idempotency: a replay returns the original spin.
  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'grid', v_existing.outcome -> 'grid',
        'lines', v_existing.outcome -> 'lines',
        'multiplier', (v_existing.detail ->> 'multiplier')::numeric,
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
  values (v_uid, 'bet', 'vslots', -p_stake, v_after, 'fortuna de ouro');

  -- Spin: pick 5 stop indices, build the 5×3 grid (3 consecutive strip cells
  -- per reel, wrapping). Strip is 1-based; stop is the 0-based logical index.
  v_grid := array_fill(''::text, array[5, 3]);
  for v_r in 1..5 loop
    v_stop := public.csprng_below(40);
    v_stops := v_stops || v_stop;
    for v_row in 0..2 loop
      v_grid[v_r][v_row + 1] := v_strip[((v_stop + v_row) % 40) + 1];
    end loop;
  end loop;

  -- Evaluate the 9 paylines: longest left-aligned run from reel 0.
  for v_li in 1..v_line_count loop
    v_sym := v_grid[1][v_lines[v_li][1] + 1];
    v_len := 1;
    for v_r in 2..5 loop
      exit when v_grid[v_r][v_lines[v_li][v_r] + 1] is distinct from v_sym;
      v_len := v_len + 1;
    end loop;

    if v_len >= 3 then
      v_mult := case v_len
                  when 3 then (v_pay3 ->> v_sym)::int
                  when 4 then (v_pay4 ->> v_sym)::int
                  else (v_pay5 ->> v_sym)::int
                end;
      v_sum := v_sum + v_mult;
      v_lines_out := v_lines_out || jsonb_build_object(
        'line', v_li - 1, 'symbol', v_sym, 'len', v_len, 'mult', v_mult);
      if v_sym = 'seven' and v_len = 5 then v_jackpot := true; end if;
    end if;
  end loop;

  v_total_mult := v_sum::numeric / v_line_count;
  v_payout := floor(p_stake * v_total_mult);

  if v_payout > 0 then
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'vslots', v_payout, v_after,
            format('fortuna de ouro %s×%s', round(v_total_mult, 2),
                   case when v_jackpot then ' JACKPOT' else '' end));
  end if;

  update public.profiles
     set balance          = v_after,
         total_wagered    = total_wagered + p_stake,
         total_won        = total_won + v_payout,
         total_lost       = total_lost + p_stake,
         biggest_win      = greatest(biggest_win, v_payout),
         games_played     = games_played + 1,
         games_won        = games_won + (case when v_payout > 0 then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  -- Serialise the grid as [[reel0row0,reel0row1,reel0row2], …].
  v_grid_out := '[]'::jsonb;
  for v_r in 1..5 loop
    v_reel_out := jsonb_build_array(v_grid[v_r][1], v_grid[v_r][2], v_grid[v_r][3]);
    v_grid_out := v_grid_out || jsonb_build_array(v_reel_out);
  end loop;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'vslots', p_stake, v_payout,
          jsonb_build_object('grid', v_grid_out, 'lines', v_lines_out),
          jsonb_build_object('multiplier', round(v_total_mult, 4), 'jackpot', v_jackpot),
          p_idempotency_key);

  return jsonb_build_object(
    'grid', v_grid_out,
    'lines', v_lines_out,
    'multiplier', round(v_total_mult, 4),
    'jackpot', v_jackpot,
    'payout', v_payout,
    'balance', v_after,
    'replayed', false
  );
end;
$$;

revoke all on function public.play_video_slot(bigint, text) from public;
grant execute on function public.play_video_slot(bigint, text) to authenticated;
