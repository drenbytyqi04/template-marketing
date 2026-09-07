# Disabled upstream migrations

These two migrations ship in the upstream `webdoagency/poster-forge-craft` repo but
are **not safe to apply to a fork**, so they are parked here instead of in
`supabase/migrations/`.

Both schedule a `pg_cron` job that runs every 15 minutes and POSTs to:

    https://project--5a3f77fc-1723-4fd4-b3a8-1d753f001fad.lovable.app/api/public/cron/automation

That is the original author's Lovable deployment, not yours. The request body also
carries a hardcoded `apikey` — the anon JWT of the *upstream* Supabase project
(`ref: zkjgwrlckuleaepshnfm`), not this one.

Applied unchanged to your project, they would make your database call a third
party's server every 15 minutes, forever, using someone else's credentials.

## Re-enabling them properly

Once this app is deployed somewhere you control:

1. Move the file back into `supabase/migrations/`.
2. Replace the `url` with your own deployment's `/api/public/cron/automation`.
3. Replace the `apikey` header with **your** project's publishable key.

Prefer reading those values from Vault rather than hardcoding them:
https://supabase.com/docs/guides/database/vault

Only the second file (`..._cron_automation_pg_net.sql.upstream`) reflects the final
upstream state — it moves `pg_net` into the `extensions` schema and supersedes the
first. If you re-enable one, re-enable that one.
