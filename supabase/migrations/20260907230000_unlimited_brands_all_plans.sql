-- Brands are no longer gated by plan. create_brand() enforced a per-plan cap and
-- raised "Your plan allows N brand(s)", so enabling the Add brand button in the UI
-- alone would have produced a save that fails at the database instead.
--
-- The brand_limit column and my_brand_limit() are kept so the cap can be
-- reintroduced later without a schema change; nothing reads them to block a
-- create any more.
create or replace function public.create_brand(_name text, _type business_type, _custom_type text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _id uuid;
begin
  if _uid is null then
    raise exception 'Authentication required';
  end if;

  insert into public.account_plans (user_id) values (_uid) on conflict (user_id) do nothing;

  insert into public.businesses (name, type, custom_type, owner_id, status, onboarded)
  values (
    coalesce(nullif(btrim(_name), ''), 'My brand'),
    _type,
    nullif(btrim(coalesce(_custom_type, '')), ''),
    _uid, 'pending', false
  )
  returning id into _id;

  insert into public.business_members (business_id, user_id, role) values (_id, _uid, 'owner');
  insert into public.brand_profiles (business_id) values (_id);
  insert into public.trial_usage (business_id) values (_id);

  return _id;
end;
$$;

revoke all on function public.create_brand(text, business_type, text) from public, anon;
grant execute on function public.create_brand(text, business_type, text) to authenticated;

-- Existing accounts keep a limit only as a display value; raise it so nothing
-- reports "0 slots left".
update public.account_plans set brand_limit = 999 where brand_limit < 999;

-- businesses_owner_unique made one brand per owner a physical constraint, so no
-- plan limit or UI change could ever have allowed a second one: the insert above
-- would fail on the unique index. The upstream schema shipped this index in its
-- first migration and added multi-brand plans afterwards, so the feature could
-- not have worked as sold.
drop index if exists public.businesses_owner_unique;

-- Owner lookups still need an index, just not a unique one.
create index if not exists businesses_owner_idx on public.businesses (owner_id);
