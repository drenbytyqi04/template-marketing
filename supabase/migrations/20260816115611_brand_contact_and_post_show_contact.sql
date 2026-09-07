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
