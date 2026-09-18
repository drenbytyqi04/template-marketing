-- Publishing to Instagram from the editor, not only from the schedule.
--
-- Three things were missing for that. A brand could hold one account per
-- platform, so an agency with two Instagram profiles had to disconnect one to
-- reach the other. Nothing recorded what had been published, so a post that
-- went out left no trace outside the schedule row that happened to trigger it.
-- And the account row knew a label but not the handle or the avatar, so the UI
-- could not show which profile it was about to post to.

-- 1. More than one account per platform.
--
-- The old key was (business_id, platform). Widening it to include the account's
-- own id is what lets a brand hold several profiles; the callback upserts on
-- the wider key, so reconnecting an account it already knows still updates that
-- row rather than adding a duplicate.
alter table public.social_oauth_accounts drop constraint if exists social_oauth_accounts_business_id_platform_key;
create unique index if not exists social_oauth_accounts_business_platform_external_key
  on public.social_oauth_accounts (business_id, platform, external_id);

-- What the picker needs to show a profile without ever reading the token.
alter table public.social_oauth_accounts add column if not exists username text not null default '';
alter table public.social_oauth_accounts add column if not exists profile_picture_url text;

-- 2. What was published, and what happened.
--
-- Kept separate from scheduled_posts: that table is a queue, and a queue row is
-- deleted or rescheduled. This is a record, and it outlives both the schedule
-- and the connection - disconnecting an account must not erase the history of
-- what it posted, so the account reference goes null rather than cascading.
create table if not exists public.social_publications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  social_account_id uuid references public.social_oauth_accounts(id) on delete set null,
  platform social_platform not null,
  account_label text not null default '',
  external_post_id text,
  caption text not null default '',
  media_path text,
  status text not null default 'pending',
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_publications_status_check
    check (status in ('pending', 'publishing', 'published', 'failed'))
);

create index if not exists social_publications_business_created_idx
  on public.social_publications (business_id, created_at desc);

alter table public.social_publications enable row level security;

-- A member reads their brand's history. Nobody writes it from a browser: the
-- only writer is the server, which holds the token and knows the real outcome.
drop policy if exists "members read publications" on public.social_publications;
create policy "members read publications" on public.social_publications
  for select
  using (public.is_business_member(business_id) or public.is_super_admin());

revoke insert, update, delete on public.social_publications from anon, authenticated;
grant all on public.social_publications to service_role;

drop trigger if exists social_publications_updated_at on public.social_publications;
create trigger social_publications_updated_at before update on public.social_publications
for each row execute function public.update_updated_at_column();
