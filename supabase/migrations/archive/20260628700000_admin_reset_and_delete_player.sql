-- ============================================================================
-- Arentim — admin: reset a player to a fresh account, or delete it entirely.
-- Both re-check is_admin() and write an admin_actions audit row, like every
-- other admin mutation.
--
-- To let a delete cascade cleanly, three profile-referencing FKs that were
-- NO ACTION are relaxed to ON DELETE SET NULL (audit history + others' rows
-- survive, just unlinked). Every other profile child FK is already ON DELETE
-- CASCADE, and profiles → auth.users is CASCADE, so deleting the auth user
-- removes the profile and all of its data.
-- ============================================================================

-- ---- Relax the FK blockers (idempotent) ------------------------------------
alter table public.admin_actions drop constraint if exists admin_actions_target_user_id_fkey;
alter table public.admin_actions add constraint admin_actions_target_user_id_fkey
  foreign key (target_user_id) references public.profiles (id) on delete set null;

alter table public.profiles drop constraint if exists profiles_referred_by_fkey;
alter table public.profiles add constraint profiles_referred_by_fkey
  foreign key (referred_by) references public.profiles (id) on delete set null;

alter table public.duels drop constraint if exists duels_winner_fkey;
alter table public.duels add constraint duels_winner_fkey
  foreign key (winner) references public.profiles (id) on delete set null;

-- ---- Reset a player to a fresh account -------------------------------------
-- Balance back to the starting amount (via a ledger 'adjustment' so the ledger
-- stays reconciled), lifetime aggregates + daily/streak/level flags zeroed, any
-- suspension cleared. History (transactions/bets) is kept for audit.
create or replace function public.admin_reset_player(p_user uuid, p_reason text)
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_balance bigint;
  v_starting bigint := 500;   -- matches handle_new_user's welcome amount
  v_delta bigint;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = 'check_violation';
  end if;

  select balance into v_balance from public.profiles where id = p_user for update;
  if not found then raise exception 'user not found'; end if;

  v_delta := v_starting - v_balance;
  -- 'adjustment' is exempt from the suspended-user trigger, so reset works even
  -- on a suspended account (which we then un-suspend below).
  insert into public.transactions (user_id, type, amount, balance_after, note)
  values (p_user, 'adjustment', v_delta, v_starting, format('Reset de conta: %s', p_reason));

  update public.profiles set
    balance          = v_starting,
    total_wagered    = 0,
    total_won        = 0,
    total_lost       = 0,
    games_played     = 0,
    games_won        = 0,
    biggest_win      = 0,
    streak_count     = 0,
    levels_claimed   = 0,
    last_played_date = null,
    last_claim_date  = null,
    last_rescue_date = null,
    last_spin_date   = null,
    suspended        = false,
    suspended_until  = null
  where id = p_user;

  perform public.admin_audit(p_user, 'reset_player',
                             jsonb_build_object('reason', p_reason, 'starting', v_starting));
  return jsonb_build_object('balance', v_starting);
end; $$;
revoke all on function public.admin_reset_player(uuid, text) from public;
grant execute on function public.admin_reset_player(uuid, text) to authenticated;

-- ---- Delete a player entirely ----------------------------------------------
-- Removes the auth user (cascades to the profile + all of its data). You cannot
-- delete yourself or another admin (de-admin them first). Audited; the deleted
-- identity is captured in the audit detail (target_user_id would be nulled by
-- the cascade anyway).
create or replace function public.admin_delete_player(p_user uuid, p_reason text)
  returns void language plpgsql volatile security definer set search_path = public as $$
declare v_target public.profiles;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = 'check_violation';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot delete your own account' using errcode = 'check_violation';
  end if;

  select * into v_target from public.profiles where id = p_user;
  if not found then raise exception 'user not found'; end if;
  if v_target.is_admin then
    raise exception 'cannot delete an admin account' using errcode = 'check_violation';
  end if;

  insert into public.admin_actions (admin_id, target_user_id, action, detail)
  values (auth.uid(), null, 'delete_player',
          jsonb_build_object('reason', p_reason, 'deleted_id', p_user, 'deleted_name', v_target.display_name));

  delete from auth.users where id = p_user;
end; $$;
revoke all on function public.admin_delete_player(uuid, text) from public;
grant execute on function public.admin_delete_player(uuid, text) to authenticated;
