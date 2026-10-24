-- Tell the owner when somebody registers.
--
-- At the source, not in the browser. A notification sent from the client only
-- fires when that particular signup form runs to the end in that particular
-- tab; an account made another way - a confirmation link finished on a phone,
-- a social sign-in, one created from the dashboard - would be silent. The
-- database sees all of them.
--
-- It is a second trigger rather than an addition to handle_new_user, which is
-- what creates the profile row. Those two jobs have very different stakes: a
-- profile that fails to be created is a broken account, a notification that
-- fails to be sent is an email nobody got. Keeping them apart means the
-- notification cannot take the profile down with it, and the block below makes
-- sure it cannot take the signup down either.

-- The extension that lets Postgres make an HTTP request. It was parked in
-- supabase/disabled until this app had a deployment of its own to call, which
-- is the whole reason those upstream migrations were unsafe: they pointed a
-- fork's database at the original author's server. This one calls krijo24.com.
create extension if not exists pg_net with schema extensions;

-- What was registered and whether the owner has been told.
--
-- The row is the record, the email is the delivery. Keeping them separate means
-- a signup that happened while the mailer was down is still written here with
-- notified_at null, so it can be seen and sent later rather than lost.
create table if not exists public.signup_notifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  error text
);

comment on table public.signup_notifications is
  'One row per registration, and whether the owner has been emailed about it.';

-- No policies, on purpose.
--
-- Row level security with nothing granted means no browser can read this table
-- at all, whoever is signed in: it holds every address that ever registered,
-- which is the account list. Only the service role, which never leaves the
-- server, reaches it.
alter table public.signup_notifications enable row level security;

create index if not exists signup_notifications_unsent_idx
  on public.signup_notifications (created_at)
  where notified_at is null;

create or replace function public.notify_new_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'net'
as $$
declare
  queued integer;
begin
  -- Written first and only once. A second call for the same account - a retry,
  -- a replayed request - inserts nothing, and the post below is skipped with
  -- it, so the owner is told about a registration exactly once.
  insert into public.signup_notifications (user_id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', ''), '')
  )
  on conflict (user_id) do nothing;

  get diagnostics queued = row_count;
  if queued = 0 then
    return new;
  end if;

  -- Queued, not sent. pg_net hands the request to a background worker and
  -- returns immediately, so nothing about signing up waits on an email, and a
  -- mail service having a bad afternoon cannot make registration slow or fail.
  --
  -- The body carries only the id. Everything the email says is read back from
  -- the database by the endpoint, with the service role, so that what is sent
  -- is what was actually registered rather than whatever arrived in a request
  -- anybody can make.
  --
  -- Neither value below is a secret. The address is the public site, and the
  -- key is the publishable one that ships inside the browser bundle and is
  -- already committed in src/integrations/supabase/config.ts; it identifies the
  -- project, it does not grant anything. What stops the endpoint being abused
  -- is on the endpoint: it will only ever send for a row that exists here and
  -- has not been sent.
  perform net.http_post(
    url := 'https://krijo24.com/api/public/hooks/new-user',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_hVismTTL0U6-0B6y5v17Qw_w-dK6gei'
    ),
    body := jsonb_build_object('user_id', new.id)
  );

  return new;
exception
  when others then
    -- Nobody loses an account because a notification could not be posted. The
    -- row above is already written either way, so the registration is still
    -- recorded and can still be sent on.
    return new;
end;
$$;

comment on function public.notify_new_signup() is
  'Records a registration and asks the site to email the owner about it.';

drop trigger if exists on_auth_user_created_notify on auth.users;
create trigger on_auth_user_created_notify
  after insert on auth.users
  for each row execute function public.notify_new_signup();
