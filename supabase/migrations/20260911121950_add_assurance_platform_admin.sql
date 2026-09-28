-- A second platform admin for krijo24. The allowlist is what claim_admin_role()
-- reads, so the address has to be here for the role to survive a re-claim.
insert into public.admin_allowlist (email)
values ('assurance@gmail.com')
on conflict (email) do nothing;

-- Grant it straight away for the account that already exists.
insert into public.user_roles (user_id, role)
select u.id, 'super_admin'::public.app_role
from auth.users u
where lower(u.email) = 'assurance@gmail.com'
on conflict (user_id, role) do nothing;
