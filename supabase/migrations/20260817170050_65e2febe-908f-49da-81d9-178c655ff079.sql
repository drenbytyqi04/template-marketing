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