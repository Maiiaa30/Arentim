-- ============================================================================
-- Arentim — Onze de Ouro: daily Portuguese-XI draft game leaderboard.
--
-- Free game (no money). One ranked attempt per day per user (the daily shared
-- challenge); we keep their best score for the day. Leaderboard shows today's
-- scores for friends/global, email-confirmed accounts only (same policy as the
-- main leaderboard). All draft/sim logic lives client-side; the server just
-- stores + ranks scores.
-- ============================================================================

create table if not exists public.onze_scores (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  day        date not null default current_date,
  score      integer not null check (score between 0 and 100000),
  rating     integer not null check (rating between 0 and 120),
  wins       integer not null check (wins between 0 and 11),
  champion   boolean not null default false,
  record     text not null,
  formation  text not null,
  xi         jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists onze_scores_day_score_idx on public.onze_scores (day, score desc);

alter table public.onze_scores enable row level security;
drop policy if exists onze_select_own on public.onze_scores;
create policy onze_select_own on public.onze_scores
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---- submit_onze_score: upsert, keeping the best score for the day ----------
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
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_score is null or p_score < 0 or p_score > 100000 then
    raise exception 'invalid score' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_xi) <> 'array' or jsonb_array_length(p_xi) <> 11 then
    raise exception 'invalid xi' using errcode = 'check_violation';
  end if;

  insert into public.onze_scores (user_id, day, score, rating, wins, champion, record, formation, xi)
  values (v_uid, current_date, p_score, greatest(0, least(120, p_rating)), greatest(0, least(11, p_wins)),
          coalesce(p_champion, false), p_record, p_formation, p_xi)
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

-- ---- onze_leaderboard: today's ranking (friends/global, verified only) ------
create or replace function public.onze_leaderboard(p_scope text)
  returns table (id uuid, display_name text, avatar_url text, score integer, record text, champion boolean, is_me boolean)
  language plpgsql stable security definer set search_path = public as $$
begin
  if p_scope not in ('global', 'friends') then
    raise exception 'invalid scope' using errcode = 'check_violation';
  end if;

  return query
  select p.id, p.display_name, p.avatar_url, s.score, s.record, s.champion, (p.id = auth.uid()) as is_me
    from public.onze_scores s
    join public.profiles p on p.id = s.user_id
   where s.day = current_date
     and exists (select 1 from auth.users u where u.id = p.id and u.email_confirmed_at is not null)
     and (
           p_scope = 'global'
        or p.id = auth.uid()
        or p.id in (
          select case when f.requester = auth.uid() then f.addressee else f.requester end
            from public.friendships f
           where f.status = 'accepted' and (f.requester = auth.uid() or f.addressee = auth.uid())
        )
     )
   order by s.score desc
   limit 50;
end; $$;

revoke all on function public.onze_leaderboard(text) from public;
grant execute on function public.onze_leaderboard(text) to authenticated;
