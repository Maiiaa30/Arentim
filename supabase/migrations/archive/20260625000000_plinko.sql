-- ============================================================================
-- Arentim — Plinko. A ball drops through `rows` peg rows (8/12/16); at each row
-- it bounces left (0) or right (1) with p = 0.5 (server CSPRNG). The landing bin
-- = the number of right-bounces, in 0..rows. The bin distribution is therefore
-- Binomial(rows, 0.5): P(k) = C(rows, k) / 2^rows. Each (rows, risk) pair has a
-- symmetric multiplier table with rows+1 entries — high at the rare edges, low
-- in the common centre. Tables are tuned so RTP = Σ P(k)·mult(k) ∈ [0.95, 0.99]:
--   8  low 0.972  medium 0.982  high 0.953
--   12 low 0.956  medium 0.957  high 0.965
--   16 low 0.963  medium 0.957  high 0.955
-- These arrays mirror PLINKO_MULT in src/features/casino/plinko.ts (pinned by a
-- unit test). Same atomic-settlement pattern as play_dice: validate →
-- idempotency → lock → debit → roll → credit → record, all in one transaction.
-- Payouts are floor(stake * multiplier).
-- ============================================================================

create or replace function public.play_plinko(
  p_stake bigint,
  p_rows int,                           -- 8 | 12 | 16
  p_risk text,                          -- 'low' | 'medium' | 'high'
  p_idempotency_key text default null
)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance bigint;
  v_after   bigint;
  v_table   numeric[];
  v_bin     int := 0;
  v_b       int;
  v_path    int[] := '{}';
  v_mult    numeric := 0;
  v_payout  bigint := 0;
  v_win     boolean := false;
  v_existing public.game_rounds;
  i int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_rows not in (8, 12, 16) then
    raise exception 'invalid rows' using errcode = 'check_violation';
  end if;
  if p_risk not in ('low', 'medium', 'high') then
    raise exception 'invalid risk' using errcode = 'check_violation';
  end if;
  if p_stake is null or p_stake <= 0 or p_stake > 1000000000000 then
    raise exception 'invalid stake' using errcode = 'check_violation';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.game_rounds where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'bin', (v_existing.outcome ->> 'bin')::int, 'path', v_existing.outcome -> 'path',
        'rows', (v_existing.outcome ->> 'rows')::int, 'risk', v_existing.outcome ->> 'risk',
        'multiplier', (v_existing.detail ->> 'multiplier')::numeric,
        'payout', v_existing.payout, 'won', (v_existing.payout > 0),
        'balance', (select balance from public.profiles where id = v_uid), 'replayed', true);
    end if;
  end if;

  select balance into v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile not found'; end if;
  if v_balance < p_stake then raise exception 'insufficient balance' using errcode = 'check_violation'; end if;

  v_after := v_balance - p_stake;
  insert into public.transactions (user_id, type, game, amount, balance_after, note)
  values (v_uid, 'bet', 'plinko', -p_stake, v_after, 'plinko');

  -- Drop the ball: at each row bounce left (0) or right (1) with p = 0.5.
  for i in 1..p_rows loop
    v_b := public.csprng_below(2);   -- 0 or 1
    v_path := v_path || v_b;
    v_bin := v_bin + v_b;
  end loop;

  -- Multiplier table mirroring PLINKO_MULT (src/features/casino/plinko.ts).
  v_table := case
    when p_rows = 8 and p_risk = 'low'    then array[4.2,1.9,1.2,0.9,0.6,0.9,1.2,1.9,4.2]
    when p_rows = 8 and p_risk = 'medium' then array[11,3,1.4,0.7,0.35,0.7,1.4,3,11]
    when p_rows = 8 and p_risk = 'high'   then array[27,4,1.4,0.3,0.2,0.3,1.4,4,27]
    when p_rows = 12 and p_risk = 'low'    then array[8,3,1.7,1.3,1.05,0.85,0.7,0.85,1.05,1.3,1.7,3,8]
    when p_rows = 12 and p_risk = 'medium' then array[27,7,2.9,1.5,1,0.7,0.6,0.7,1,1.5,2.9,7,27]
    when p_rows = 12 and p_risk = 'high'   then array[165,19,5.5,1.8,0.7,0.4,0.35,0.4,0.7,1.8,5.5,19,165]
    when p_rows = 16 and p_risk = 'low'    then array[12,3.6,2.1,1.6,1.3,1.05,0.95,0.9,0.85,0.9,0.95,1.05,1.3,1.6,2.1,3.6,12]
    when p_rows = 16 and p_risk = 'medium' then array[70,17,5.8,3,1.7,1.2,0.9,0.75,0.7,0.75,0.9,1.2,1.7,3,5.8,17,70]
    when p_rows = 16 and p_risk = 'high'   then array[880,127,25,7,2.2,1,0.6,0.5,0.4,0.5,0.6,1,2.2,7,25,127,880]
  end;

  v_mult := v_table[v_bin + 1];   -- 1-based array
  v_payout := floor(p_stake * v_mult);
  v_win := v_payout > p_stake;    -- a "win" = came out ahead

  if v_payout > 0 then
    v_after := v_after + v_payout;
    insert into public.transactions (user_id, type, game, amount, balance_after, note)
    values (v_uid, 'win', 'plinko', v_payout, v_after, format('plinko %sx', v_mult));
  end if;

  update public.profiles
     set balance = v_after, total_wagered = total_wagered + p_stake, total_won = total_won + v_payout,
         total_lost = total_lost + p_stake, biggest_win = greatest(biggest_win, v_payout),
         games_played = games_played + 1, games_won = games_won + (case when v_win then 1 else 0 end),
         last_played_date = current_date
   where id = v_uid;

  insert into public.game_rounds (user_id, game, stake, payout, outcome, detail, idempotency_key)
  values (v_uid, 'plinko', p_stake, v_payout,
          jsonb_build_object('bin', v_bin, 'path', to_jsonb(v_path), 'rows', p_rows, 'risk', p_risk),
          jsonb_build_object('multiplier', v_mult), p_idempotency_key);

  return jsonb_build_object('bin', v_bin, 'path', to_jsonb(v_path), 'rows', p_rows, 'risk', p_risk,
                            'multiplier', v_mult, 'won', v_win, 'payout', v_payout,
                            'balance', v_after, 'replayed', false);
end;
$$;
revoke all on function public.play_plinko(bigint, int, text, text) from public;
grant execute on function public.play_plinko(bigint, int, text, text) to authenticated;
