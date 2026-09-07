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