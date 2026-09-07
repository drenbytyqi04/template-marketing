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