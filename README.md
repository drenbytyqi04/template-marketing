# Krijo24

Create RAFTY V1. Keep it extremely simple. Build a production-quality responsive SaaS UI for branded social post creation. Core flow: upload ONE image, enter a few details (Offer/Title, Destination, Business/Product, optional Price, optional Date/Month, optional Additional text), optionally select included services, optionally generate an AI caption, then Generate Post, preview, edit text, save, and download. One picture per post only.

Design: premium minimalist SaaS, white/light surfaces, violet/purple accents, tasteful gradients, blurred/glass overlays, rounded cards, subtle shadows, strong typography. Main Create page: left compact form, right large live 4:5 preview on desktop; stacked elegantly on mobile. Minimal navigation: Create, Posts, Templates, Brand, Settings. Mobile uses compact bottom navigation. No unnecessary text.

Critical product rule: templates control ALL visual layout. AI only creates/re-writes text. Do not let AI redesign layouts. Templates use dynamic placeholders such as title, destination, business, price, date, services, additional_text, image, logo. Build a small deterministic template system with a few polished example templates. Generated posts should often use modern gradients, blur, image overlays, and editorial compositions.

Business brand: simple logo, brand colors, font settings. Multi-tenant structure with Supabase-ready architecture and tenant isolation. Keep database simple. Do not implement social publishing, scheduling, billing, analytics, competitor research, team collaboration, video, multi-image posts, advanced admin, or other features not listed. Make primary interactions functional and use realistic demo content. This is the first implementation, so prioritize the Create workflow and polished responsive UX over breadth.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://poster-forge-craft.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5a3f77fc-1723-4fd4-b3a8-1d753f001fad).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Supabase setup (self-hosted fork)

This fork is wired to **your own** Supabase project, not the original Lovable one.

### 1. Create a project

Create a new, **empty** project at [supabase.com/dashboard](https://supabase.com/dashboard).
Do not reuse a project that already hosts another app: the schema below creates
`public.profiles`, replaces `public.handle_new_user()`, and repoints the
`on_auth_user_created` trigger on `auth.users`, which would break an existing app.

### 2. Apply the schema

**If you connected the Supabase GitHub integration** (Dashboard > Project Settings >
Integrations > GitHub), migrations in `supabase/migrations/` are applied automatically
when the configured *production branch* is pushed. Nothing to do by hand - just make sure
that branch is the one carrying this code.

**Otherwise**, open **SQL Editor > New query**, paste [`supabase/setup.sql`](supabase/setup.sql),
and run it once. That file is every migration concatenated in chronological order and
wrapped in a transaction. Or use the CLI:

```sh
npx supabase link --project-ref evspytufythlndhxudez
npx supabase db push
```

### 3. Configure environment variables

```sh
cp .env.example .env
```

Fill in the values from **Project Settings > Data API** (URL) and **API Keys**:

| Variable | Where to find it | Secret? |
| --- | --- | --- |
| `SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PROJECT_ID` | Your project ref | No |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Data API > Project URL | No |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | API Keys > publishable (or legacy anon) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | API Keys > service_role | **Yes** |

The `VITE_`-prefixed copies are what the browser bundle reads; keep them identical to
their unprefixed counterparts. `SUPABASE_SERVICE_ROLE_KEY` is server-only and bypasses
row-level security - never prefix it with `VITE_` and never commit it. `.env` is gitignored.

### 4. Run

```sh
bun install   # or: npm install
bun run dev
```

## Deploying to Vercel

Two things have to be true or the deployment serves nothing.

### 1. Vercel must build a branch that exists

Vercel deploys the *production branch* configured on the project, `main` by default.
This repo's work originally lived only on a feature branch, so a Vercel project
pointed at `main` had nothing to build. `main` now carries the full project.

### 2. Environment variables must be set in Vercel

`.env` is gitignored, so Vercel never receives it. Without these the Supabase client
throws on first use and server-side rendering fails, which renders as a blank or
error page rather than an obvious message.

In **Vercel > Project > Settings > Environment Variables**, add:

| Variable | Value | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | |
| `SUPABASE_PUBLISHABLE_KEY` | your publishable key | |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` | baked into the browser bundle at build time |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | same as `SUPABASE_PUBLISHABLE_KEY` | baked in at build time |
| `SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PROJECT_ID` | your project ref | |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key | **secret** - server only |

The `VITE_`-prefixed values are substituted during the build, so changing them
requires a redeploy, not just a restart.

Optional, only for features that need them:

| Variable | Enables |
| --- | --- |
| `META_APP_ID`, `META_APP_SECRET` | Facebook / Instagram publishing |
| `CRON_SECRET` | the `/api/public/cron/automation` worker |
| `LOVABLE_API_KEY`, `RESEND_API_KEY` | contact-form email delivery |

### Build target

Nitro auto-detects the platform it is building on, so Vercel gets the `vercel`
preset without configuration (locally it falls back to `cloudflare-module`). If a
deployment ever builds for the wrong target, set `NITRO_PRESET=vercel` as an
environment variable - no code change needed.

## Instagram publishing

The app can publish a finished design straight to an Instagram Professional
account. It uses Meta's official Graph API and the standard OAuth flow: nobody
is ever asked for an Instagram password, and no unofficial endpoint is touched.

Without `META_APP_ID` and `META_APP_SECRET` the app runs normally and the
Instagram card says it is not configured. Nothing crashes and nothing pretends
to be connected.

### What Instagram requires

Meta only allows publishing to a **Professional** account (Business or Creator)
that is **linked to a Facebook Page**. A personal Instagram account cannot be
published to by any application, including this one. The person who connects it
must be an admin of that Page.

### 1. Create the Meta app

At <https://developers.facebook.com/apps>, create an app of type **Business**
and add the **Facebook Login** product. Copy the App ID and App Secret from
Settings → Basic into `META_APP_ID` and `META_APP_SECRET`.

### 2. Register the redirect URI

Under Facebook Login → Settings, add to **Valid OAuth Redirect URIs**:

```
https://<your-domain>/api/public/oauth/meta
```

Add the localhost form too if you will connect while developing. The value must
match exactly - scheme, host and path.

### 3. Permissions

The connect flow requests:

| Permission | Why |
| --- | --- |
| `pages_show_list` | find the Pages the person administers |
| `pages_read_engagement` | read the Page the Instagram account is linked to |
| `pages_manage_posts` | publish to the Facebook Page |
| `instagram_basic` | read the linked Instagram account |
| `instagram_content_publish` | publish to Instagram |
| `business_management` | resolve accounts held in a Business portfolio |

### 4. App Review

While the app is in development mode these permissions work **only for people
with a role on the Meta app** (admin, developer, tester). That is enough to
test the whole flow end to end with your own accounts.

To let your customers connect, Meta requires **App Review** for
`instagram_content_publish`, `instagram_basic`, `pages_show_list`,
`pages_read_engagement` and `pages_manage_posts`, plus **Business
Verification** for the business that owns the app. Prepare a screencast of the
connect-and-publish flow and a description of why each permission is needed.
Until that is granted, connecting works for your own accounts and for nobody
else's.

### How publishing works

1. The editor renders the design through the same exporter the Download button
   uses, so what is published is the file you would have downloaded.
2. That image is stored in the private `rafty-media` bucket.
3. On publish the server signs a one-hour URL to it. Meta fetches the image with
   its own servers, which is why a public URL is needed at all; the bucket stays
   private and the link expires.
4. For Instagram the server creates a media container, waits for Meta to finish
   processing it, then publishes it, and finally asks for the post's permalink.
5. The result is written to `social_publications`, successful or not.

Access tokens live in `social_oauth_accounts`, a table with `revoke all` for
`anon` and `authenticated`: only the service role can read it, and no endpoint
returns a token to the browser.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
