-- The product's own admin address becomes a platform admin.
--
-- Two separate things have to be true for an account to hold the role, and the
-- earlier admin migrations each did only one of them, which is why a role kept
-- having to be re-granted by hand: the allowlist is what claim_admin_role()
-- reads on every sign in, and user_roles is what RLS reads on every query. An
-- address in the allowlist but not in user_roles has no powers until it signs in
-- again; an address in user_roles but not in the allowlist loses them the moment
-- somebody reconciles the two. Both, and it holds.
insert into public.admin_allowlist (email)
values ('admin@krijo24.com')
on conflict (email) do nothing;

-- Grant it straight away if the account already exists. If it does not, the
-- allowlist entry above is picked up by claim_admin_role() the first time it
-- signs in - which is also what the trigger below covers, for an account
-- created while nobody is watching.
insert into public.user_roles (user_id, role)
select u.id, 'super_admin'::public.app_role
from auth.users u
where lower(u.email) = 'admin@krijo24.com'
on conflict (user_id, role) do nothing;

-- An allowlisted address gets the role when the account is created, not when it
-- next signs in.
--
-- claim_admin_role() only runs from the browser, so until now the first visit
-- after registering was an ordinary user's visit: the admin link was absent and
-- every admin read came back empty, because RLS asks user_roles and nothing had
-- written to it yet. A reload fixed it, which made it look intermittent rather
-- than wrong. The allowlist is the decision; this makes the grant follow it
-- immediately.
create or replace function public.grant_allowlisted_admin()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.email is null then
    return new;
  end if;
  if exists (select 1 from public.admin_allowlist a where lower(a.email) = lower(new.email)) then
    insert into public.user_roles (user_id, role)
    values (new.id, 'super_admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
exception
  -- A registration must never fail because of this. Somebody who should be an
  -- admin and is not can still claim the role by signing in; an account that
  -- cannot be created at all is a locked door.
  when others then
    return new;
end;
$$;

revoke all on function public.grant_allowlisted_admin() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_grant_admin on auth.users;
create trigger on_auth_user_created_grant_admin
  after insert on auth.users
  for each row execute function public.grant_allowlisted_admin();
