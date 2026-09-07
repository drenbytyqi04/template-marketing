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
