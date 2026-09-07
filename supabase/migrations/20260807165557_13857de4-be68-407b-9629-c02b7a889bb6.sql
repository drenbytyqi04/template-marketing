-- RLS policy expressions are evaluated as the querying role, so authenticated
-- needs EXECUTE on these helpers for tenant policies to work at all.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_business_id() TO authenticated;