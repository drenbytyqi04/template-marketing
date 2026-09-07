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

-- Add your own address here, then this project's admin is you:
--   insert into public.admin_allowlist (email) values ('you@example.com')
--     on conflict (email) do nothing;
-- Sign in with it once and call the claim_admin_role() RPC to receive the role.
