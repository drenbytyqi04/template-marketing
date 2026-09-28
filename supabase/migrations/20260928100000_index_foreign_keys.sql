-- Every foreign key in the schema, given the index it was missing.
--
-- Postgres does not index a foreign key for you. Two things suffer without it.
-- Reads: the posts grid asks for one business's posts and that is the hottest
-- query the app makes, answered until now by reading every row in the table.
-- Writes: deleting a parent has to prove no child still points at it, so
-- removing one business scanned every posts, service and template row there is.
--
-- These tables are small today, which is exactly why this is cheap to do now.

create index if not exists posts_business_idx on public.posts (business_id);
create index if not exists business_services_business_idx on public.business_services (business_id);
create index if not exists custom_templates_business_idx on public.custom_templates (business_id);
create index if not exists custom_template_requests_business_idx on public.custom_template_requests (business_id);
create index if not exists custom_template_requests_template_idx on public.custom_template_requests (template_id);
create index if not exists discovered_items_post_idx on public.discovered_items (post_id);
create index if not exists scheduled_posts_post_idx on public.scheduled_posts (post_id);
create index if not exists social_publications_post_idx on public.social_publications (post_id);
create index if not exists social_publications_account_idx on public.social_publications (social_account_id);
