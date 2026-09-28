-- The identity a policy checks against is the same for every row it reads.
--
-- Written bare, `auth.uid()` is called again for each row the query touches, so
-- reading a thousand rows asked who the caller was a thousand times. Wrapped in
-- a scalar sub-select, the planner works it out once and reuses it. The test
-- each row is put to is unchanged - this is the form Supabase's own linter asks
-- for, and the policies below say exactly what they said before.

alter policy "Users read own plan" on public.account_plans
  using (((user_id = (select auth.uid())) or (select public.is_super_admin())));

alter policy "Members can read their memberships" on public.business_members
  using (((user_id = (select auth.uid())) or (select public.is_super_admin())));

alter policy "Users can insert own profile" on public.profiles
  with check ((id = (select auth.uid())));

alter policy "Users can read own profile" on public.profiles
  using (((id = (select auth.uid())) or (select public.is_super_admin())));

alter policy "Users can update own profile" on public.profiles
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

alter policy "Users can read their own roles" on public.user_roles
  using ((user_id = (select auth.uid())));
