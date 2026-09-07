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