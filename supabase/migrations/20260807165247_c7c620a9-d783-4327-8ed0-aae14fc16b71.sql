-- Internal trigger/event functions: never callable through the API
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_business_privileged_fields() FROM PUBLIC, anon, authenticated;

-- Anonymous role must not execute any SECURITY DEFINER helper
REVOKE ALL ON FUNCTION public.create_my_business(text, business_type, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_post_usage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_business_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_business_id() FROM PUBLIC, anon;

-- Policy helper functions are only needed while evaluating RLS policies,
-- which run as the table owner's policy expressions with postgres EXECUTE.
-- Signed-in users must not be able to call them directly over the Data API.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_business_member(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM authenticated;
REVOKE ALL ON FUNCTION public.my_business_id() FROM authenticated;

-- The two real user-facing RPCs stay callable by signed-in users only
GRANT EXECUTE ON FUNCTION public.create_my_business(text, business_type, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_post_usage(uuid) TO authenticated;