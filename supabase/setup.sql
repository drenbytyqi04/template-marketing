-- poster-forge-craft / Krijo24 - full schema bootstrap
-- Generated from supabase/migrations/*.sql in chronological order.
--
-- Redundant if the Supabase GitHub integration or MCP has already applied
-- supabase/migrations/. See supabase/disabled/README.md for the two upstream
-- cron migrations that are deliberately excluded.
--
-- WARNING: creates public.profiles, replaces public.handle_new_user(), and
-- repoints the on_auth_user_created trigger on auth.users. Never run it
-- against a project that already hosts another application.

begin;

-- ============================================================
-- 20260807163259_186f74dd-9807-488c-928e-a79d3ee5b3b4.sql
-- ============================================================

-- ============================================================
-- Rafty security foundation
-- ============================================================

-- Roles -------------------------------------------------------
create type public.app_role as enum ('super_admin', 'business_user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'super_admin')
$$;

create policy "Users can read their own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

create policy "Admins can read all roles"
  on public.user_roles for select to authenticated
  using (public.is_super_admin());

create policy "Admins can manage roles"
  on public.user_roles for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Shared updated_at trigger ----------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles ----------------------------------------------------
create table public.profiles (
  id uuid primary key,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin());
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Businesses --------------------------------------------------
create type public.business_type as enum (
  'travel_agency', 'real_estate', 'car_dealership', 'restaurant', 'retail', 'other'
);
create type public.business_status as enum ('pending', 'approved', 'rejected', 'suspended');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.business_type not null default 'other',
  custom_type text,
  status public.business_status not null default 'pending',
  owner_id uuid not null,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index businesses_owner_unique on public.businesses (owner_id);

grant select, insert, update on public.businesses to authenticated;
grant all on public.businesses to service_role;
alter table public.businesses enable row level security;

create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.update_updated_at_column();

-- Membership --------------------------------------------------
create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

grant select on public.business_members to authenticated;
grant all on public.business_members to service_role;
alter table public.business_members enable row level security;

-- Ownership resolution: always derived from auth.uid(), never from the client.
create or replace function public.is_business_member(_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = _business_id and user_id = auth.uid()
  )
$$;

create or replace function public.my_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from public.business_members
  where user_id = auth.uid()
  order by created_at
  limit 1
$$;

create policy "Members can read their memberships"
  on public.business_members for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());
create policy "Admins can manage memberships"
  on public.business_members for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "Members can read their business"
  on public.businesses for select to authenticated
  using (public.is_business_member(id) or public.is_super_admin());
create policy "Members can update their business"
  on public.businesses for update to authenticated
  using (public.is_business_member(id) or public.is_super_admin())
  with check (public.is_business_member(id) or public.is_super_admin());
create policy "Admins can insert businesses"
  on public.businesses for insert to authenticated
  with check (public.is_super_admin());
create policy "Admins can delete businesses"
  on public.businesses for delete to authenticated
  using (public.is_super_admin());
grant delete on public.businesses to authenticated;

-- Normal members may not change approval status or ownership.
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
  end if;
  return new;
end;
$$;

create trigger businesses_guard_privileged
  before update on public.businesses
  for each row execute function public.guard_business_privileged_fields();

-- Brand profile -----------------------------------------------
create table public.brand_profiles (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  logo_path text,
  primary_color text not null default '#7c5cff',
  secondary_color text not null default '#0f1020',
  font_family text not null default 'Inter',
  currency text not null default 'EUR',
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.brand_profiles to authenticated;
grant all on public.brand_profiles to service_role;
alter table public.brand_profiles enable row level security;

create policy "Members manage own brand"
  on public.brand_profiles for all to authenticated
  using (public.is_business_member(business_id) or public.is_super_admin())
  with check (public.is_business_member(business_id) or public.is_super_admin());

create trigger brand_profiles_updated_at before update on public.brand_profiles
  for each row execute function public.update_updated_at_column();

-- Services ----------------------------------------------------
create table public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.business_services to authenticated;
grant all on public.business_services to service_role;
alter table public.business_services enable row level security;

create policy "Members manage own services"
  on public.business_services for all to authenticated
  using (public.is_business_member(business_id) or public.is_super_admin())
  with check (public.is_business_member(business_id) or public.is_super_admin());

-- Custom templates --------------------------------------------
create table public.custom_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  engine text not null,
  variant jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.custom_templates to authenticated;
grant all on public.custom_templates to service_role;
alter table public.custom_templates enable row level security;

create policy "Members read own custom templates"
  on public.custom_templates for select to authenticated
  using (public.is_business_member(business_id) or public.is_super_admin());
create policy "Admins manage custom templates"
  on public.custom_templates for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create trigger custom_templates_updated_at before update on public.custom_templates
  for each row execute function public.update_updated_at_column();

-- Custom template requests ------------------------------------
create type public.template_request_status as enum ('processing', 'ready', 'rejected');

create table public.custom_template_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  file_name text not null,
  file_type text,
  file_path text,
  status public.template_request_status not null default 'processing',
  template_id uuid references public.custom_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert on public.custom_template_requests to authenticated;
grant all on public.custom_template_requests to service_role;
alter table public.custom_template_requests enable row level security;

create policy "Members read own template requests"
  on public.custom_template_requests for select to authenticated
  using (public.is_business_member(business_id) or public.is_super_admin());
create policy "Members create own template requests"
  on public.custom_template_requests for insert to authenticated
  with check (public.is_business_member(business_id));
create policy "Admins manage template requests"
  on public.custom_template_requests for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
grant update, delete on public.custom_template_requests to authenticated;

create trigger custom_template_requests_updated_at before update on public.custom_template_requests
  for each row execute function public.update_updated_at_column();

-- Posts -------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  template_id text not null,
  content jsonb not null default '{}'::jsonb,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;

create policy "Members manage own posts"
  on public.posts for all to authenticated
  using (public.is_business_member(business_id) or public.is_super_admin())
  with check (public.is_business_member(business_id) or public.is_super_admin());

create trigger posts_updated_at before update on public.posts
  for each row execute function public.update_updated_at_column();

-- Trial usage -------------------------------------------------
create table public.trial_usage (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  posts_created integer not null default 0,
  free_post_limit integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.trial_usage to authenticated;
grant all on public.trial_usage to service_role;
alter table public.trial_usage enable row level security;

create policy "Members read own trial"
  on public.trial_usage for select to authenticated
  using (public.is_business_member(business_id) or public.is_super_admin());
create policy "Admins manage trials"
  on public.trial_usage for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
grant insert, update, delete on public.trial_usage to authenticated;

create trigger trial_usage_updated_at before update on public.trial_usage
  for each row execute function public.update_updated_at_column();

-- Trial counting stays server side so a client cannot fake remaining credits.
create or replace function public.register_post_usage(_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_business_member(_business_id) then
    raise exception 'Not a member of this business';
  end if;
  insert into public.trial_usage (business_id, posts_created)
  values (_business_id, 1)
  on conflict (business_id)
  do update set posts_created = public.trial_usage.posts_created + 1, updated_at = now();
end;
$$;

revoke all on function public.register_post_usage(uuid) from public;
grant execute on function public.register_post_usage(uuid) to authenticated;

-- Atomic onboarding: business + membership + brand + trial ----
create or replace function public.create_my_business(
  _name text,
  _type public.business_type,
  _custom_type text default null
)
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

  insert into public.businesses (name, type, custom_type, owner_id, status, onboarded)
  values (coalesce(nullif(btrim(_name), ''), 'My business'), _type, nullif(btrim(coalesce(_custom_type, '')), ''), _uid, 'pending', false)
  returning id into _id;

  insert into public.business_members (business_id, user_id, role) values (_id, _uid, 'owner');
  insert into public.brand_profiles (business_id) values (_id);
  insert into public.trial_usage (business_id) values (_id);

  return _id;
end;
$$;

revoke all on function public.create_my_business(text, public.business_type, text) from public;
grant execute on function public.create_my_business(text, public.business_type, text) to authenticated;

-- ============================================================
-- 20260807163322_78374e39-e880-4f06-bde0-619df72e9c0c.sql
-- ============================================================

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

-- ============================================================
-- 20260807163400_929b32ab-2742-422f-aa57-6ca4c485d612.sql
-- ============================================================

-- Path convention: rafty-media/<business_id>/<kind>/<file>
create policy "Members read own business files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'rafty-media'
    and (
      public.is_business_member(nullif((storage.foldername(name))[1], '')::uuid)
      or public.is_super_admin()
    )
  );

create policy "Members upload own business files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'rafty-media'
    and (
      public.is_business_member(nullif((storage.foldername(name))[1], '')::uuid)
      or public.is_super_admin()
    )
  );

create policy "Members update own business files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'rafty-media'
    and (
      public.is_business_member(nullif((storage.foldername(name))[1], '')::uuid)
      or public.is_super_admin()
    )
  )
  with check (
    bucket_id = 'rafty-media'
    and (
      public.is_business_member(nullif((storage.foldername(name))[1], '')::uuid)
      or public.is_super_admin()
    )
  );

create policy "Members delete own business files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'rafty-media'
    and (
      public.is_business_member(nullif((storage.foldername(name))[1], '')::uuid)
      or public.is_super_admin()
    )
  );

-- ============================================================
-- 20260807165247_c7c620a9-d783-4327-8ed0-aae14fc16b71.sql
-- ============================================================

-- Internal trigger/event functions: never callable through the API
-- NOTE: public.rls_auto_enable() is referenced here but never created by any
-- migration in this repo, so a bare REVOKE aborts on a clean database.
-- Guarded so the statement is a no-op when the function is absent.
do $guard$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  end if;
end
$guard$;
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

-- ============================================================
-- 20260807165557_13857de4-be68-407b-9629-c02b7a889bb6.sql
-- ============================================================

-- RLS policy expressions are evaluated as the querying role, so authenticated
-- needs EXECUTE on these helpers for tenant policies to work at all.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_business_id() TO authenticated;

-- ============================================================
-- 20260811190815_275ede84-8466-4857-ad34-b3b85dcad437.sql
-- ============================================================

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

-- ============================================================
-- 20260816115611_brand_contact_and_post_show_contact.sql
-- ============================================================

-- Contact information as a reusable brand asset, plus a per post opt in flag.

-- brand_profiles already has RLS scoping rows to business members (see prior
-- migrations). Adding a plain jsonb column does not change access rules, so
-- no policy changes are needed here, the existing select/update policies
-- already cover this column.
alter table public.brand_profiles
  add column if not exists contact_info jsonb not null default '{}'::jsonb;

-- posts already has RLS scoping rows to business members. This boolean is
-- just post level data, no policy changes are needed.
alter table public.posts
  add column if not exists show_contact boolean not null default false;


-- ============================================================
-- 20260816121246_0e8072f2-4b12-4d24-93e9-e3cb50bc5368.sql
-- ============================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'post',
  ADD COLUMN IF NOT EXISTS slides jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_format_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_format_check CHECK (format IN ('post','carousel','video','story'));

-- ============================================================
-- 20260816123815_ce7b0367-53e7-4f9e-ac85-73256ec3aaf9.sql
-- ============================================================

alter type plan_tier add value if not exists 'studio';

alter table public.account_plans
  add column if not exists monthly_price integer not null default 50,
  add column if not exists active boolean not null default false,
  add column if not exists allow_carousel boolean not null default false,
  add column if not exists allow_video boolean not null default false,
  add column if not exists allow_custom_templates boolean not null default true;

-- Backfill prices from the historical tiers so existing accounts keep working.
update public.account_plans
set monthly_price = case plan when 'starter' then 50 when 'growth' then 100 when 'partnership' then 200 else 50 end
where monthly_price is null or monthly_price = 0;

create or replace function public.plan_defaults(_monthly_price integer)
returns table (brand_limit integer, allow_carousel boolean, allow_video boolean, partnership_posts_limit integer)
language sql
immutable
set search_path = public
as $$
  select
    case
      when _monthly_price >= 200 then 1
      when _monthly_price >= 150 then 2
      else 1
    end,
    _monthly_price >= 100,
    _monthly_price >= 100,
    case when _monthly_price >= 200 then ((_monthly_price - 200) / 100 + 1) * 30 else 0 end
$$;

-- Admin only entitlement activation. Users can never grant themselves features.
create or replace function public.admin_set_plan(
  _user_id uuid,
  _monthly_price integer,
  _active boolean,
  _billing_cycle text default 'monthly',
  _brand_limit integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  _tier plan_tier;
begin
  if not public.is_super_admin() then
    raise exception 'Only platform admins can change entitlements';
  end if;
  if _monthly_price < 0 then
    raise exception 'Invalid price';
  end if;

  select * into d from public.plan_defaults(_monthly_price);

  _tier := case
    when _monthly_price >= 200 then 'partnership'::plan_tier
    when _monthly_price >= 150 then 'studio'::plan_tier
    when _monthly_price >= 100 then 'growth'::plan_tier
    else 'starter'::plan_tier
  end;

  insert into public.account_plans (
    user_id, plan, monthly_price, active, billing_cycle, brand_limit,
    allow_carousel, allow_video, allow_custom_templates, partnership_posts_limit
  )
  values (
    _user_id, _tier, _monthly_price, _active, coalesce(_billing_cycle, 'monthly'),
    coalesce(_brand_limit, d.brand_limit), d.allow_carousel, d.allow_video, true, d.partnership_posts_limit
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    monthly_price = excluded.monthly_price,
    active = excluded.active,
    billing_cycle = excluded.billing_cycle,
    brand_limit = excluded.brand_limit,
    allow_carousel = excluded.allow_carousel,
    allow_video = excluded.allow_video,
    partnership_posts_limit = excluded.partnership_posts_limit,
    updated_at = now();
end;
$$;

revoke all on function public.admin_set_plan(uuid, integer, boolean, text, integer) from public, anon;
grant execute on function public.admin_set_plan(uuid, integer, boolean, text, integer) to authenticated;
revoke all on function public.plan_defaults(integer) from public, anon;
grant execute on function public.plan_defaults(integer) to authenticated;

-- Server side format gate: a business may only store multi frame content when
-- the owning account has an activated plan that includes those formats.
create or replace function public.guard_post_format()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner uuid;
  _allowed boolean;
begin
  if coalesce(new.format, 'post') = 'post' then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;
  select owner_id into _owner from public.businesses where id = new.business_id;
  select (p.active and (case when new.format = 'carousel' then p.allow_carousel else p.allow_video end))
    into _allowed
  from public.account_plans p where p.user_id = _owner;
  if not coalesce(_allowed, false) then
    raise exception 'Your plan does not include % content. Ask a Rafty admin to activate it.', new.format;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_guard_format on public.posts;
create trigger posts_guard_format
before insert or update on public.posts
for each row execute function public.guard_post_format();

revoke all on function public.guard_post_format() from public, anon, authenticated;

-- Brand limit now reads the activated entitlement, still database enforced.
create or replace function public.my_brand_limit()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select brand_limit from public.account_plans where user_id = auth.uid()), 1)
$$;


-- ============================================================
-- 20260816145247_7e501212-0adb-4aa2-a7b4-71847db86b64.sql
-- ============================================================

create type public.schedule_status as enum ('queued','cancelled','published','failed');
create type public.social_platform as enum ('instagram','facebook','linkedin','tiktok','x','youtube');
create type public.social_conn_status as enum ('unavailable','not_connected','connected','ready','failed');

create table public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  platform public.social_platform not null,
  scheduled_at timestamptz not null,
  timezone text not null default 'UTC',
  status public.schedule_status not null default 'queued',
  note text not null default '',
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.scheduled_posts to authenticated;
grant all on public.scheduled_posts to service_role;
alter table public.scheduled_posts enable row level security;

create policy "Members manage own schedules" on public.scheduled_posts
for all to authenticated
using (public.is_business_member(business_id) or public.is_super_admin())
with check (public.is_business_member(business_id) or public.is_super_admin());

create index scheduled_posts_business_idx on public.scheduled_posts (business_id, scheduled_at);

create or replace function public.guard_schedule_owner()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _owner uuid;
begin
  select business_id into _owner from public.posts where id = new.post_id;
  if _owner is null or _owner is distinct from new.business_id then
    raise exception 'Scheduled item must belong to the same brand as the post';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_schedule_owner() from public, anon;

create trigger scheduled_posts_guard_owner
before insert or update on public.scheduled_posts
for each row execute function public.guard_schedule_owner();

create trigger scheduled_posts_updated_at
before update on public.scheduled_posts
for each row execute function public.update_updated_at_column();

create table public.brand_social_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  platform public.social_platform not null,
  status public.social_conn_status not null default 'not_connected',
  account_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, platform)
);

grant select, insert, update, delete on public.brand_social_connections to authenticated;
grant all on public.brand_social_connections to service_role;
alter table public.brand_social_connections enable row level security;

create policy "Members manage own connections" on public.brand_social_connections
for all to authenticated
using (public.is_business_member(business_id) or public.is_super_admin())
with check (public.is_business_member(business_id) or public.is_super_admin());

create trigger brand_social_connections_updated_at
before update on public.brand_social_connections
for each row execute function public.update_updated_at_column();

-- ============================================================
-- 20260816163854_20081048-f200-49fd-bb8e-b31876cde096.sql
-- ============================================================

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS show_contact boolean NOT NULL DEFAULT false;
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS contact_info jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.template_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, template_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_favorites TO authenticated;
GRANT ALL ON public.template_favorites TO service_role;

ALTER TABLE public.template_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage own template favorites"
ON public.template_favorites FOR ALL TO authenticated
USING (public.is_business_member(business_id) OR public.is_super_admin())
WITH CHECK (public.is_business_member(business_id) OR public.is_super_admin());

-- ============================================================
-- 20260817162706_3348d6c8-b7d7-4a84-b1f4-a2fdda7e5be6.sql
-- ============================================================

-- 1. New business types (soft categories only, never restrict templates)
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'hotel';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'beauty';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'fitness';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'healthcare';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'construction';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'cleaning';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'events';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'education';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'professional_services';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'ecommerce';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'automotive_service';

-- 2. Database backed admin allowlist. No client side email checks.
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_allowlist TO authenticated;
GRANT ALL ON public.admin_allowlist TO service_role;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage the allowlist" ON public.admin_allowlist;
CREATE POLICY "Admins manage the allowlist"
  ON public.admin_allowlist FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

INSERT INTO public.admin_allowlist (email) VALUES ('contact@webdoagency.com')
  ON CONFLICT (email) DO NOTHING;

-- Grants the platform admin role to the signed in user only when their
-- verified JWT email is on the allowlist. The email never comes from the client.
CREATE OR REPLACE FUNCTION public.claim_admin_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if _uid is null or _email = '' then
    return false;
  end if;
  if not exists (select 1 from public.admin_allowlist where lower(email) = _email) then
    return public.has_role(_uid, 'super_admin');
  end if;
  insert into public.user_roles (user_id, role)
  values (_uid, 'super_admin')
  on conflict (user_id, role) do nothing;
  return true;
end;
$$;

REVOKE ALL ON FUNCTION public.claim_admin_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_role() TO authenticated;

-- Existing auth user with that email gets the role right away.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role
FROM auth.users u
JOIN public.admin_allowlist a ON lower(a.email) = lower(u.email)
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Demo / contact requests from the public site
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  business text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.contact_requests TO authenticated;
GRANT ALL ON public.contact_requests TO service_role;
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can send a demo request" ON public.contact_requests;
CREATE POLICY "Anyone can send a demo request"
  ON public.contact_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(name)) between 1 and 100
    AND length(btrim(email)) between 3 and 255
    AND email like '%@%'
    AND length(coalesce(business, '')) <= 120
    AND length(coalesce(message, '')) <= 2000
  );

DROP POLICY IF EXISTS "Admins read demo requests" ON public.contact_requests;
CREATE POLICY "Admins read demo requests"
  ON public.contact_requests FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Admins update demo requests" ON public.contact_requests;
CREATE POLICY "Admins update demo requests"
  ON public.contact_requests FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 4. Product name in user facing database messages
CREATE OR REPLACE FUNCTION public.guard_brand_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if public.is_super_admin() then
    return new;
  end if;
  if old.logo_locked and new.logo_path is distinct from old.logo_path then
    raise exception 'Brand logo can only be changed by a krijo24 admin';
  end if;
  if new.logo_path is not null and old.logo_path is null then
    new.logo_locked := true;
  end if;
  if old.logo_locked and new.logo_locked = false then
    raise exception 'Brand logo lock cannot be removed';
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.guard_business_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_super_admin() then
    if new.status is distinct from old.status then
      raise exception 'Only platform admins can change approval status';
    end if;
    if new.owner_id is distinct from old.owner_id then
      raise exception 'Business ownership cannot be reassigned';
    end if;
    if old.onboarded and new.name is distinct from old.name then
      raise exception 'Business name can only be changed by a krijo24 admin';
    end if;
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.guard_post_format()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  _owner uuid;
  _allowed boolean;
begin
  if coalesce(new.format, 'post') = 'post' then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;
  select owner_id into _owner from public.businesses where id = new.business_id;
  select (p.active and (case when new.format = 'carousel' then p.allow_carousel else p.allow_video end))
    into _allowed
  from public.account_plans p where p.user_id = _owner;
  if not coalesce(_allowed, false) then
    raise exception 'Your plan does not include % content. Ask a krijo24 admin to activate it.', new.format;
  end if;
  return new;
end;
$$;

REVOKE ALL ON FUNCTION public.guard_brand_identity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_business_privileged_fields() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_post_format() FROM PUBLIC, anon;

-- 5. Profile row exists for every new account, so display names persist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 20260817162726_74a333f4-5b82-4830-844d-d28946b5ec62.sql
-- ============================================================

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 20260817170050_65e2febe-908f-49da-81d9-178c655ff079.sql
-- ============================================================

-- 1. Enforce post quota / approval at the database boundary (was client-only)
create or replace function public.guard_post_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _status business_status;
  _limit integer;
  _count integer;
  _active boolean;
  _owner uuid;
begin
  if public.is_super_admin() then
    return new;
  end if;

  select status, owner_id into _status, _owner from public.businesses where id = new.business_id;
  if _status is null then
    raise exception 'Unknown brand';
  end if;
  if _status in ('rejected', 'suspended') then
    raise exception 'This brand cannot create content right now.';
  end if;

  select active into _active from public.account_plans where user_id = _owner;

  -- Approved brands with an active plan create freely; everyone else is on the trial allowance.
  if _status = 'approved' and coalesce(_active, false) then
    return new;
  end if;

  select coalesce(free_post_limit, 1) into _limit from public.trial_usage where business_id = new.business_id;
  _limit := coalesce(_limit, 1);
  select count(*) into _count from public.posts where business_id = new.business_id;
  if _count >= _limit then
    raise exception 'Free trial limit reached for this brand. A krijo24 admin can activate your plan.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_post_quota() from public;
revoke all on function public.guard_post_quota() from anon;
revoke all on function public.guard_post_quota() from authenticated;

drop trigger if exists posts_guard_quota on public.posts;
create trigger posts_guard_quota before insert on public.posts
for each row execute function public.guard_post_quota();

-- 2. Never let a client claim a social connection is live; only admins can move
--    a connection past "not connected" until a real integration exists.
create or replace function public.guard_social_connection_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;
  if new.status not in ('not_connected', 'unavailable', 'failed') then
    raise exception 'This platform connection is not available yet.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_social_connection_status() from public;
revoke all on function public.guard_social_connection_status() from anon;
revoke all on function public.guard_social_connection_status() from authenticated;

drop trigger if exists brand_social_connections_guard_status on public.brand_social_connections;
create trigger brand_social_connections_guard_status
before insert or update on public.brand_social_connections
for each row execute function public.guard_social_connection_status();

-- 3. Scheduled posts must never claim publication without a real integration.
create or replace function public.guard_schedule_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;
  if new.status = 'published' then
    raise exception 'Publishing is not available yet, so a queued item cannot be marked as published.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_schedule_status() from public;
revoke all on function public.guard_schedule_status() from anon;
revoke all on function public.guard_schedule_status() from authenticated;

drop trigger if exists scheduled_posts_guard_status on public.scheduled_posts;
create trigger scheduled_posts_guard_status
before insert or update on public.scheduled_posts
for each row execute function public.guard_schedule_status();

-- ============================================================
-- 20260818192140_5ce6151e-32e6-4a31-bc5a-1773daec3b0c.sql
-- ============================================================

-- 1. Rendered post image (uploaded by the app) so the publish worker can post the real branded output
alter table public.posts add column if not exists render_path text;

-- 2. Approve a brand and activate its plan in one admin action
create or replace function public.admin_approve_business(_business_id uuid, _monthly_price integer default 100)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare _owner uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Not allowed';
  end if;
  select owner_id into _owner from public.businesses where id = _business_id;
  if _owner is null then
    raise exception 'Unknown brand';
  end if;
  update public.businesses set status = 'approved', updated_at = now() where id = _business_id;
  perform public.admin_set_plan(_owner, _monthly_price, true, 'monthly');
end;
$$;
revoke all on function public.admin_approve_business(uuid, integer) from public, anon;
grant execute on function public.admin_approve_business(uuid, integer) to authenticated;

-- 3. Brand website (source for scanning) -------------------------------------
create table if not exists public.brand_websites (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  url text not null default '',
  scan_frequency text not null default 'off',
  auto_mode text not null default 'off',
  default_template_id text,
  post_time text not null default '10:00',
  timezone text not null default 'UTC',
  platforms text[] not null default '{}',
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.brand_websites to authenticated;
grant all on public.brand_websites to service_role;
alter table public.brand_websites enable row level security;
drop policy if exists "Members manage own website" on public.brand_websites;
create policy "Members manage own website" on public.brand_websites for all to authenticated
  using (public.is_business_member(business_id) or public.is_super_admin())
  with check (public.is_business_member(business_id) or public.is_super_admin());
drop trigger if exists brand_websites_updated_at on public.brand_websites;
create trigger brand_websites_updated_at before update on public.brand_websites
for each row execute function public.update_updated_at_column();

-- 4. Items discovered from the website ---------------------------------------
create table if not exists public.discovered_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source_url text not null,
  fingerprint text not null,
  title text not null default '',
  description text not null default '',
  price text not null default '',
  currency text not null default '',
  image_url text,
  status text not null default 'new',
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, fingerprint)
);
grant select, insert, update, delete on public.discovered_items to authenticated;
grant all on public.discovered_items to service_role;
alter table public.discovered_items enable row level security;
drop policy if exists "Members manage own discovered items" on public.discovered_items;
create policy "Members manage own discovered items" on public.discovered_items for all to authenticated
  using (public.is_business_member(business_id) or public.is_super_admin())
  with check (public.is_business_member(business_id) or public.is_super_admin());
drop trigger if exists discovered_items_updated_at on public.discovered_items;
create trigger discovered_items_updated_at before update on public.discovered_items
for each row execute function public.update_updated_at_column();

-- 5. OAuth tokens for real publishing. Server only, no client role may read it.
create table if not exists public.social_oauth_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  platform social_platform not null,
  external_id text not null default '',
  account_label text not null default '',
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, platform)
);
revoke all on public.social_oauth_accounts from anon, authenticated;
grant all on public.social_oauth_accounts to service_role;
alter table public.social_oauth_accounts enable row level security;
drop trigger if exists social_oauth_accounts_updated_at on public.social_oauth_accounts;
create trigger social_oauth_accounts_updated_at before update on public.social_oauth_accounts
for each row execute function public.update_updated_at_column();

-- 6. The publish worker (service role, no auth.uid()) may record a real result
create or replace function public.guard_schedule_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return new; -- trusted server worker (service role), the only publisher
  end if;
  if public.is_super_admin() then
    return new;
  end if;
  if new.status = 'published' then
    raise exception 'Only krijo24 publishing can mark an item as published.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_schedule_status() from public, anon, authenticated;

-- 7. Same for connection status: a real OAuth connection is written server side
create or replace function public.guard_social_connection_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;
  if new.status not in ('not_connected', 'unavailable', 'failed') then
    raise exception 'This platform connection is not available yet.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_social_connection_status() from public, anon, authenticated;

-- 8. Remote post ids on the queue so a published item can be traced
alter table public.scheduled_posts add column if not exists remote_post_id text;
alter table public.scheduled_posts add column if not exists published_at timestamptz;

-- ============================================================
-- 20260907120000_create_rafty_media_bucket.sql
-- ============================================================

-- The RLS policies in 20260807163400 reference bucket_id = 'rafty-media', but no
-- migration ever created the bucket itself - it was made out-of-band in the Lovable
-- dashboard. Without this, uploads fail on a freshly provisioned project.
--
-- Keep it PRIVATE: the app reads media exclusively through createSignedUrl()
-- (src/lib/rafty/repo.ts, src/routes/api/public/cron/automation.ts).
insert into storage.buckets (id, name, public)
values ('rafty-media', 'rafty-media', false)
on conflict (id) do nothing;


-- ============================================================
-- 20260907190000_reset_admin_allowlist.sql
-- ============================================================

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


commit;
