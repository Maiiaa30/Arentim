-- ============================================================================
-- Arentim — referral / invite system. Every profile gets a short, unique
-- referral_code. When a new user signs up via someone's link and claims it,
-- BOTH sides are credited Tostões (a 'bonus' ledger row + balance bump) and the
-- referrer gets a notification. Claiming is idempotent: a profile can only ever
-- be referred once (the referred_by guard), so the credit fires at most once.
-- ============================================================================

-- ---- Schema ----------------------------------------------------------------
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by uuid references public.profiles (id);

-- A short, human-friendly code: 8 hex chars uppercased from 6 random bytes.
create or replace function public.gen_referral_code()
  returns text
  language sql
  volatile
  set search_path = public, extensions
as $$
  select upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
$$;

-- Stamp a code on every new profile that doesn't bring its own. Retry a few
-- times on the (astronomically unlikely) unique collision.
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
  loop
    v_attempt := v_attempt + 1;
    v_code := public.gen_referral_code();
    if not exists (select 1 from public.profiles where referral_code = v_code) then
      new.referral_code := v_code;
      return new;
    end if;
    exit when v_attempt >= 5;
  end loop;
  -- Deterministic fallback derived from the id (guaranteed unique per row).
  new.referral_code := upper(substr(md5(new.id::text), 1, 8));
  return new;
end;
$$;

drop trigger if exists trg_set_referral_code on public.profiles;
create trigger trg_set_referral_code
  before insert on public.profiles
  for each row execute function public.set_referral_code();

-- Backfill existing rows. md5(id) is deterministic and effectively unique, so a
-- single update suffices.
update public.profiles
   set referral_code = upper(substr(md5(id::text), 1, 8))
 where referral_code is null;

-- ---- Read: my own referral state -------------------------------------------
create or replace function public.my_referral()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = public
as $$
  select jsonb_build_object(
    'code', p.referral_code,
    'referred_by', p.referred_by,
    'referred_count', (
      select count(*)::int from public.profiles r where r.referred_by = p.id
    )
  )
  from public.profiles p
  where p.id = auth.uid();
$$;
revoke all on function public.my_referral() from public;
grant execute on function public.my_referral() to authenticated;

-- ---- Mutation: claim a referral code ---------------------------------------
-- Rewards (play-money) — tweak here to change the economics.
--   new user (the one signing up via a link): +100 tós
--   referrer (the link owner):                +250 tós
create or replace function public.claim_referral(p_code text)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  c_new_reward      constant bigint := 100;
  c_referrer_reward constant bigint := 250;
  v_uid          uuid := auth.uid();
  v_referrer     uuid;
  v_already      uuid;
  v_my_balance   bigint;
  v_my_after     bigint;
  v_ref_balance  bigint;
  v_ref_after    bigint;
  v_my_name      text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Lock the caller's row; if already referred, no-op (idempotent guard).
  select referred_by, balance, display_name
    into v_already, v_my_balance, v_my_name
    from public.profiles
   where id = v_uid
   for update;
  if not found then
    raise exception 'profile not found';
  end if;
  if v_already is not null then
    return jsonb_build_object('status', 'already');
  end if;

  -- Resolve the referrer by code (case-insensitive).
  select id into v_referrer
    from public.profiles
   where referral_code = upper(nullif(trim(p_code), ''));
  if v_referrer is null or v_referrer = v_uid then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Mark the relationship + credit the new user.
  v_my_after := v_my_balance + c_new_reward;
  update public.profiles
     set referred_by = v_referrer, balance = v_my_after
   where id = v_uid;
  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (v_uid, 'bonus', c_new_reward, v_my_after, 'Bónus de convite');

  -- Credit the referrer.
  select balance into v_ref_balance from public.profiles where id = v_referrer for update;
  v_ref_after := v_ref_balance + c_referrer_reward;
  update public.profiles set balance = v_ref_after where id = v_referrer;
  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (v_referrer, 'bonus', c_referrer_reward, v_ref_after,
          format('Convidaste %s', coalesce(v_my_name, 'um amigo')));

  -- Notify the referrer.
  insert into public.notifications (user_id, type, title, body, link, data)
  values (v_referrer, 'referral', 'Um amigo juntou-se!',
          '+' || c_referrer_reward || ' tós — ' || coalesce(v_my_name, 'um amigo') || ' inscreveu-se com o teu link',
          '/friends',
          jsonb_build_object('from', v_uid, 'amount', c_referrer_reward));

  return jsonb_build_object('status', 'claimed', 'reward', c_new_reward, 'balance', v_my_after);
end;
$$;
revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;
