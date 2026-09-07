# Unlimited posts on active plans + website scanning with auto-publishing

Two pieces of work: fix the post allowance so approved brands on an active plan are never blocked, and build a real (not simulated) pipeline that reads a business website, turns products/offers into posts, and publishes them to social media once credentials are added.

## 1. Unlimited posts, brands still capped

Today the database allows unlimited posts only when the brand is approved **and** the owner's plan row is `active`, while the app grants unlimited as soon as the brand is approved. That mismatch means an approved brand whose plan was never activated sees no warning but gets an error when saving.

- Single source of truth: unlimited post creation when brand status is `approved` and the plan is `active`. Otherwise the trial allowance applies.
- Brand count stays capped by plan (1 / 1 / 2 / partnership) — unchanged.
- Header pill and the Create page lock message reflect the same rule, with a clear "your plan is not active yet — contact krijo24" state instead of a silent failure.
- Admin: approving a business and activating its plan happen in one action so the two never drift apart again.

## 2. Website scanning

- Brand settings gets a **Website** field (saved per brand) plus an on-demand "Scan a URL" box.
- Scanning runs server-side: fetch the page, parse structured data (JSON-LD `Product`/`Offer`, Open Graph, then heading/price/image fallbacks), and extract title, description, price + currency, and the main image.
- Results land in a **Discovered items** list per brand: image, title, price, source URL, status (new / used / ignored).
- Each item can be turned into a post with one click — it prefills the existing Create flow (template, image, title, price, caption), so templates still own the layout and nothing about the design pipeline changes.
- **Auto-create**: optional per brand. Recurring scan (daily/weekly) of the saved site; new items are generated into posts automatically using a chosen default template, and land as drafts or queued items depending on the setting below.
- Robots/etiquette: respect `robots.txt`, cap page count and response size, only scan the brand's own domain.

## 3. Automatic publishing (built fully, credentials added after)

- Real OAuth connections per brand and platform: Instagram Business / Facebook Page, LinkedIn Page. Tokens are stored server-side only, encrypted-at-rest in a table no client role can read, with refresh handling.
- Settings > Social becomes a real Connect flow. A platform shows "Connect when available" only when its credentials are not configured yet — never a fake connected state.
- A scheduled queue worker runs on a cron endpoint: it takes due queued items, renders the post image server-side, uploads to the platform, and writes back `published` with the remote post ID, or `failed` with the real error. Nothing is marked published unless the platform confirmed it.
- Auto-pilot per brand: scan → generate → schedule at chosen times/days → publish. Can be set to "review first" (queue as draft) or "fully automatic".
- Existing guard triggers that block clients from claiming `published` stay in place; only the server worker can set it.

### What you'll need to add afterwards
1. **Meta** (Instagram + Facebook): create an app at developers.facebook.com, add Instagram Graph API + Facebook Login, request `instagram_basic`, `instagram_content_publish`, `pages_manage_posts`, `pages_read_engagement`; submit for App Review; give me the App ID + App Secret and add the redirect URL I'll provide.
2. **LinkedIn**: create an app, request `w_member_social` / `w_organization_social` via Community Management API access, then give me Client ID + Secret.
3. **Cron**: I'll expose a public scan/publish endpoint; you point a scheduler at it (or I wire pg_cron) with a shared secret.
4. TikTok / X / YouTube stay "Connect when available" — their publishing APIs need separate approval and aren't part of this pass.

## Technical notes

- New tables: `brand_websites` (url, scan frequency, auto-create mode, last scanned), `discovered_items` (brand-scoped extracted product/offer + status + source hash for dedupe), `social_oauth_accounts` (service-role-only tokens, no `anon`/`authenticated` grants). All brand-scoped tables get RLS via `is_business_member(business_id)`; grants written alongside each table.
- Scanning and publishing run in TanStack server functions (`.functions.ts`) with `requireSupabaseAuth`; the cron worker is a server route under `src/routes/api/public/` guarded by a shared-secret header and never trusts a client-supplied `business_id`.
- Server-side image rendering for publishing reuses the existing deterministic 1080x1350 template model so published output matches the preview.
- OAuth callbacks are public routes that resolve the brand from a signed state parameter, exchange the code server-side, and store tokens with the admin client only.
- Quota change is a migration updating `guard_post_quota` plus the matching client rule in the store; secrets go through the secret store, never the database or client bundle.
