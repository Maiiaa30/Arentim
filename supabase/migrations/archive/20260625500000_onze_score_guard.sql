-- ============================================================================
-- Arentim — Onze de Ouro score: a light server-side sanity guard.
--
-- The Onze draft/simulation runs entirely in the browser and the daily board is
-- a VANITY board — it touches no balance, payout or economy, so it is left
-- intentionally client-scored (re-running the full sim server-side isn't worth
-- it). This guard just rejects the most blatant inconsistency a tampered client
-- could submit: being "champion" with zero wins. Range clamps stay as before.
-- ============================================================================

create or replace function public.submit_onze_score(
  p_score integer,
  p_rating integer,
  p_wins integer,
  p_champion boolean,
  p_record text,
  p_formation text,
  p_xi jsonb
)
  returns jsonb language plpgsql volatile
  security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_best integer;
  v_wins integer := greatest(0, least(11, coalesce(p_wins, 0)));
  v_champion boolean := coalesce(p_champion, false) and v_wins > 0;  -- no champion with 0 wins
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_score is null or p_score < 0 or p_score > 100000 then
    raise exception 'invalid score' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_xi) <> 'array' or jsonb_array_length(p_xi) <> 11 then
    raise exception 'invalid xi' using errcode = 'check_violation';
  end if;

  insert into public.onze_scores (user_id, day, score, rating, wins, champion, record, formation, xi)
  values (v_uid, current_date, p_score, greatest(0, least(120, p_rating)), v_wins,
          v_champion, p_record, p_formation, p_xi)
  on conflict (user_id, day) do update
    set score = greatest(public.onze_scores.score, excluded.score),
        rating = case when excluded.score > public.onze_scores.score then excluded.rating else public.onze_scores.rating end,
        wins = case when excluded.score > public.onze_scores.score then excluded.wins else public.onze_scores.wins end,
        champion = case when excluded.score > public.onze_scores.score then excluded.champion else public.onze_scores.champion end,
        record = case when excluded.score > public.onze_scores.score then excluded.record else public.onze_scores.record end,
        formation = case when excluded.score > public.onze_scores.score then excluded.formation else public.onze_scores.formation end,
        xi = case when excluded.score > public.onze_scores.score then excluded.xi else public.onze_scores.xi end,
        updated_at = now();

  select score into v_best from public.onze_scores where user_id = v_uid and day = current_date;
  return jsonb_build_object('best', v_best);
end; $$;

revoke all on function public.submit_onze_score(integer, integer, integer, boolean, text, text, jsonb) from public;
grant execute on function public.submit_onze_score(integer, integer, integer, boolean, text, text, jsonb) to authenticated;
