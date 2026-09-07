-- 1. Plans and brand entitlements
create type public.plan_tier as enum ('starter', 'growth', 'partnership');

create table public.account_plans (
  user_id uuid primary key,
  plan public.plan_tier not null default 'starter',
  brand_limit integer not null default 1,
  billing_cycle text not null default 'monthly',
  partnership_posts_used integer not null default 0,
  partnership_posts_limit integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.account_plans to authenticated;
grant all on public.account_plans to service_role;
alter table public.account_plans enable row level security;

create policy "Users read own plan" on public.account_plans
  for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
create policy "Admins manage plans" on public.account_plans
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create trigger account_plans_updated_at before update on public.account_plans
  for each row execute function public.update_updated_at_column();

-- backfill a starter plan for every existing owner
insert into public.account_plans (user_id)
select distinct owner_id from public.businesses
on conflict (user_id) do nothing;

create or replace function public.my_brand_limit()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select brand_limit from public.account_plans where user_id = auth.uid()), 1)
$$;

revoke all on function public.my_brand_limit() from public, anon;
grant execute on function public.my_brand_limit() to authenticated;

-- 2. Brand identity fields
alter table public.brand_profiles
  add column if not exists accent_color text not null default '#ff7a59',
  add column if not exists background_color text,
  add column if not exists font_secondary text,
  add column if not exists show_brand_name boolean not null default false,
  add column if not exists logo_locked boolean not null default false,
  add column if not exists content_instructions jsonb not null default '{}'::jsonb;

update public.brand_profiles set logo_locked = true where logo_path is not null;

-- Logo immutability for normal users: first save locks it, only admins can change it after.
create or replace function public.guard_brand_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;
  if old.logo_locked and new.logo_path is distinct from old.logo_path then
    raise exception 'Brand logo can only be changed by a Rafty admin';
  end if;
  if new.logo_path is not null and old.logo_path is null then
    new.logo_locked := true;
  end if;
  if not new.logo_locked is distinct from old.logo_locked then
    null;
  end if;
  if old.logo_locked and new.logo_locked = false then
    raise exception 'Brand logo lock cannot be removed';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_brand_identity() from public, anon, authenticated;

create trigger brand_profiles_guard_identity before update on public.brand_profiles
  for each row execute function public.guard_brand_identity();

-- Business name/type become admin-only once onboarding is complete
create or replace function public.guard_business_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    if new.status is distinct from old.status then
      raise exception 'Only platform admins can change approval status';
    end if;
    if new.owner_id is distinct from old.owner_id then
      raise exception 'Business ownership cannot be reassigned';
    end if;
    if old.onboarded and new.name is distinct from old.name then
      raise exception 'Business name can only be changed by a Rafty admin';
    end if;
    if old.onboarded and new.type is distinct from old.type then
      raise exception 'Business type can only be changed by a Rafty admin';
    end if;
  end if;
  return new;
end;
$$;

-- 3. Extra brands respect the plan brand limit
create or replace function public.create_brand(_name text, _type business_type, _custom_type text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _count integer;
  _limit integer;
  _id uuid;
begin
  if _uid is null then
    raise exception 'Authentication required';
  end if;

  select count(*) into _count from public.businesses where owner_id = _uid;
  select coalesce(brand_limit, 1) into _limit from public.account_plans where user_id = _uid;
  if _limit is null then
    insert into public.account_plans (user_id) values (_uid) on conflict (user_id) do nothing;
    _limit := 1;
  end if;
  if _count >= _limit then
    raise exception 'Your plan allows % brand(s). Upgrade to add another brand.', _limit;
  end if;

  insert into public.businesses (name, type, custom_type, owner_id, status, onboarded)
  values (coalesce(nullif(btrim(_name), ''), 'My brand'), _type, nullif(btrim(coalesce(_custom_type, '')), ''), _uid, 'pending', false)
  returning id into _id;

  insert into public.business_members (business_id, user_id, role) values (_id, _uid, 'owner');
  insert into public.brand_profiles (business_id) values (_id);
  insert into public.trial_usage (business_id) values (_id);

  return _id;
end;
$$;

revoke all on function public.create_brand(text, business_type, text) from public, anon;
grant execute on function public.create_brand(text, business_type, text) to authenticated;

-- first brand creation stays idempotent, and now seeds a plan row
create or replace function public.create_my_business(_name text, _type business_type, _custom_type text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _existing uuid;
  _id uuid;
begin
  if _uid is null then
    raise exception 'Authentication required';
  end if;

  select business_id into _existing from public.business_members
  where user_id = _uid order by created_at limit 1;
  if _existing is not null then
    return _existing;
  end if;

  insert into public.account_plans (user_id) values (_uid) on conflict (user_id) do nothing;

  insert into public.businesses (name, type, custom_type, owner_id, status, onboarded)
  values (coalesce(nullif(btrim(_name), ''), 'My business'), _type, nullif(btrim(coalesce(_custom_type, '')), ''), _uid, 'pending', false)
  returning id into _id;

  insert into public.business_members (business_id, user_id, role) values (_id, _uid, 'owner');
  insert into public.brand_profiles (business_id) values (_id);
  insert into public.trial_usage (business_id) values (_id);

  return _id;
end;
$$;

-- 4. Service ordering
alter table public.business_services
  add column if not exists position integer not null default 0;

-- 5. Post caption, adjustments and share status
alter table public.posts
  add column if not exists caption text not null default '',
  add column if not exists adjustments jsonb not null default '{}'::jsonb,
  add column if not exists show_brand_name boolean not null default false,
  add column if not exists share_status jsonb not null default '{}'::jsonb;

-- 6. Custom templates: locked design layer + mapped dynamic zones
alter table public.custom_templates
  add column if not exists background_path text,
  add column if not exists requirements text,
  add column if not exists zones jsonb not null default '[]'::jsonb,
  add column if not exists locked_design boolean not null default true;

drop policy if exists "Members read own custom templates" on public.custom_templates;
create policy "Members read own custom templates" on public.custom_templates
  for select to authenticated
  using (public.is_business_member(business_id) or public.is_super_admin());
create policy "Members create own custom templates" on public.custom_templates
  for insert to authenticated
  with check (public.is_business_member(business_id));
create policy "Members update own custom templates" on public.custom_templates
  for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));
create policy "Members delete own custom templates" on public.custom_templates
  for delete to authenticated
  using (public.is_business_member(business_id));