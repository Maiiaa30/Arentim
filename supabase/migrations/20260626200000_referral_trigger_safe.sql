-- ============================================================================
-- Arentim — FIX: the referral before-insert trigger must NEVER be able to abort
-- a profile insert. A profile is created inside Supabase's handle_new_user
-- trigger during sign-up, so if set_referral_code() ever raised (e.g. a
-- gen_random_bytes / search_path hiccup), the whole sign-up failed with an
-- opaque "Database error saving new user" ({}). Wrap the code generation in an
-- exception block that always falls back to a deterministic md5(id) code, and
-- schema-qualify gen_random_bytes so it can't depend on search_path.
-- ============================================================================

create or replace function public.gen_referral_code()
  returns text
  language sql
  volatile
  set search_path = public, extensions
as $$
  select upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
$$;

create or replace function public.set_referral_code()
  returns trigger
  language plpgsql
  set search_path = public, extensions
as $$
declare
  v_code    text;
  v_attempt int := 0;
begin
  if new.referral_code is not null then
    return new;
  end if;
  begin
    loop
      v_attempt := v_attempt + 1;
      v_code := public.gen_referral_code();
      if not exists (select 1 from public.profiles where referral_code = v_code) then
        new.referral_code := v_code;
        return new;
      end if;
      exit when v_attempt >= 5;
    end loop;
    new.referral_code := upper(substr(md5(new.id::text), 1, 8));
  exception when others then
    -- Never let referral-code generation break account creation.
    new.referral_code := upper(substr(md5(new.id::text), 1, 8));
  end;
  return new;
end;
$$;
