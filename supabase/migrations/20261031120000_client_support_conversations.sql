-- Somewhere for a customer to ask krijo24 something, and get an answer.
--
-- Until now the only route in was the public contact form, which writes a row
-- nobody signed in can see again - a customer who asked for their plan to be
-- activated had no way to tell whether the message had arrived, and the admin
-- had no way to answer in the product. Everything moved to email, where it is
-- outside the account it is about.
--
-- One thread per thing asked, which is what makes a status mean anything:
-- "being handled" is true of a request, not of a customer.

create type public.conversation_status as enum ('active', 'in_progress', 'resolved');

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- Kept if the person leaves: the brand still owns the thread, and an answer
  -- to it is still an answer.
  created_by uuid references auth.users(id) on delete set null,
  topic text not null default 'other',
  subject text not null,
  status public.conversation_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  -- When each side last looked. Two columns rather than one per message, so
  -- "anything new?" is a comparison and not a count.
  client_read_at timestamptz not null default now(),
  admin_read_at timestamptz,
  constraint support_conversations_subject_length check (
    length(btrim(subject)) between 1 and 80
  ),
  constraint support_conversations_topic_known check (
    topic in ('plan', 'templates', 'account', 'technical', 'other')
  )
);

create index if not exists support_conversations_business_idx
  on public.support_conversations (business_id, last_message_at desc);
create index if not exists support_conversations_status_idx
  on public.support_conversations (status, last_message_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  -- Which side wrote it. Never taken from the client: the trigger below sets it
  -- from the sender's actual role, so nobody can post a message that looks like
  -- it came from krijo24.
  from_admin boolean not null default false,
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_body_length check (length(btrim(body)) between 1 and 4000)
);

create index if not exists support_messages_conversation_idx
  on public.support_messages (conversation_id, created_at);

grant select, insert, update on public.support_conversations to authenticated;
grant select, insert on public.support_messages to authenticated;
grant all on public.support_conversations to service_role;
grant all on public.support_messages to service_role;

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "Members read their conversations" on public.support_conversations;
create policy "Members read their conversations"
  on public.support_conversations for select to authenticated
  using (public.is_business_member(business_id) or public.is_super_admin());

drop policy if exists "Members open a conversation" on public.support_conversations;
create policy "Members open a conversation"
  on public.support_conversations for insert to authenticated
  with check (public.is_business_member(business_id) or public.is_super_admin());

-- What a member may actually change here is narrow, and the trigger below is
-- what narrows it: row level security can say which rows, not which columns.
drop policy if exists "Members touch their conversations" on public.support_conversations;
create policy "Members touch their conversations"
  on public.support_conversations for update to authenticated
  using (public.is_business_member(business_id) or public.is_super_admin())
  with check (public.is_business_member(business_id) or public.is_super_admin());

drop policy if exists "Members read their messages" on public.support_messages;
create policy "Members read their messages"
  on public.support_messages for select to authenticated
  using (
    exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id
        and (public.is_business_member(c.business_id) or public.is_super_admin())
    )
  );

drop policy if exists "Members write to their conversations" on public.support_messages;
create policy "Members write to their conversations"
  on public.support_messages for insert to authenticated
  with check (
    exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id
        and (public.is_business_member(c.business_id) or public.is_super_admin())
    )
  );

-- No update and no delete policy, for anybody. A message history that either
-- side can rewrite afterwards is not a history, and the status on a thread is
-- an assurance about what was said in it.

/*
 * The status, the subject and the other side's read mark are not the
 * customer's to set.
 *
 * A customer who could move their own request to "In progress" would be
 * telling themselves it is being handled, which is the one thing this feature
 * is supposed to guarantee is true. The guard is skipped for the trigger below,
 * which touches the same row on the customer's behalf when they send a message
 * - that update is the product's, not theirs, and it says so with a flag that
 * lives for the length of the transaction and cannot be set from a client.
 */
create or replace function public.guard_support_conversation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(current_setting('krijo24.thread_update', true), '') = 'system' then
    return new;
  end if;

  if public.is_super_admin() then
    -- An admin reading a thread does not mark it read for the customer.
    new.client_read_at := old.client_read_at;
  else
    if new.status is distinct from old.status then
      raise exception 'Only krijo24 can change the status of a request';
    end if;
    if new.subject is distinct from old.subject
       or new.topic is distinct from old.topic
       or new.business_id is distinct from old.business_id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'A request cannot be rewritten after it is sent';
    end if;
    new.admin_read_at := old.admin_read_at;
    new.last_message_at := old.last_message_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.guard_support_conversation() from public, anon, authenticated;

drop trigger if exists support_conversation_guard on public.support_conversations;
create trigger support_conversation_guard
  before update on public.support_conversations
  for each row execute function public.guard_support_conversation();

/** Who wrote it is read from the sender, never from the request. */
create or replace function public.stamp_support_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.author_id := auth.uid();
  new.from_admin := public.is_super_admin();
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.stamp_support_message() from public, anon, authenticated;

drop trigger if exists support_message_stamp on public.support_messages;
create trigger support_message_stamp
  before insert on public.support_messages
  for each row execute function public.stamp_support_message();

/**
 * Sending a message moves the thread it belongs to.
 *
 * A customer writing again on a thread somebody closed reopens it. The
 * alternative is a request marked Resolved with an unanswered question under
 * it, which is exactly the state this feature exists to make impossible.
 */
create or replace function public.touch_support_conversation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform set_config('krijo24.thread_update', 'system', true);
  update public.support_conversations
  set last_message_at = new.created_at,
      updated_at = new.created_at,
      status = case
        when not new.from_admin and status = 'resolved' then 'active'::public.conversation_status
        else status
      end,
      -- The side that just wrote has, self-evidently, read it.
      client_read_at = case when new.from_admin then client_read_at else new.created_at end,
      admin_read_at = case when new.from_admin then new.created_at else admin_read_at end
  where id = new.conversation_id;
  perform set_config('krijo24.thread_update', '', true);
  return new;
end;
$$;

revoke all on function public.touch_support_conversation() from public, anon, authenticated;

drop trigger if exists support_message_touches_conversation on public.support_messages;
create trigger support_message_touches_conversation
  after insert on public.support_messages
  for each row execute function public.touch_support_conversation();
