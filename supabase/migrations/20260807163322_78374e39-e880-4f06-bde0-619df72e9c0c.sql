-- Internal helpers must not be callable from the public API surface.
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
revoke all on function public.guard_business_privileged_fields() from public, anon, authenticated;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.is_business_member(uuid) from public, anon;
revoke all on function public.my_business_id() from public, anon;
revoke all on function public.register_post_usage(uuid) from public, anon;
revoke all on function public.create_my_business(text, public.business_type, text) from public, anon;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.my_business_id() to authenticated;
grant execute on function public.register_post_usage(uuid) to authenticated;
grant execute on function public.create_my_business(text, public.business_type, text) to authenticated;