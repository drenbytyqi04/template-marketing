-- The upstream migration (20260817162706) seeds the original developer's address
-- into public.admin_allowlist. On a fork that is a standing backdoor: anyone who
-- signs up with that address gets super_admin through public.claim_admin_role().
delete from public.admin_allowlist where lower(email) = 'contact@webdoagency.com';

-- Revoke the role too, in case that address already claimed it on this project.
delete from public.user_roles ur
using auth.users u
where ur.user_id = u.id
  and ur.role = 'super_admin'
  and lower(u.email) = 'contact@webdoagency.com';

-- This fork's platform admin.
insert into public.admin_allowlist (email)
values ('dren.bytyqi19@gmail.com')
on conflict (email) do nothing;

-- If that account already exists, grant the role right away; otherwise signing in
-- and calling the claim_admin_role() RPC once picks it up from the allowlist.
insert into public.user_roles (user_id, role)
select u.id, 'super_admin'::public.app_role
from auth.users u
where lower(u.email) = 'dren.bytyqi19@gmail.com'
on conflict (user_id, role) do nothing;
