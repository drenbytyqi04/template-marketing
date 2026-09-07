-- The RLS policies in 20260807163400 reference bucket_id = 'rafty-media', but no
-- migration ever created the bucket itself - it was made out-of-band in the Lovable
-- dashboard. Without this, uploads fail on a freshly provisioned project.
--
-- Keep it PRIVATE: the app reads media exclusively through createSignedUrl()
-- (src/lib/rafty/repo.ts, src/routes/api/public/cron/automation.ts).
insert into storage.buckets (id, name, public)
values ('rafty-media', 'rafty-media', false)
on conflict (id) do nothing;
