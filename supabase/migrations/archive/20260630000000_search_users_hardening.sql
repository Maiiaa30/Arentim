-- Harden search_users (pentest finding L3, 2026-06-30).
--
-- Two issues with the original definition:
--   1. An empty / 1-char query matched EVERY user (ilike '%%'), so any authed
--      user could enumerate the whole user list (UUIDs + display names, incl.
--      the admin accounts). No PII leaked, but it's free enumeration.
--   2. LIKE metacharacters in the query (% and _) were not escaped, so a query
--      like "%" also matched everything and "_" was a wildcard.
--
-- Fix: require a trimmed query of at least 2 characters, and escape the LIKE
-- metacharacters in the user-supplied term. Same signature / columns / grants,
-- so the frontend contract is unchanged.
create or replace function public.search_users(p_query text)
  returns table (id uuid, display_name text, avatar_url text)
  language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url
    from public.profiles p
   where p.id <> auth.uid()
     and length(btrim(coalesce(p_query, ''))) >= 2
     and p.display_name ilike
         '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
         escape '\'
   order by p.display_name
   limit 10;
$$;
revoke all on function public.search_users(text) from public, anon;
grant execute on function public.search_users(text) to authenticated;
