import { createFileRoute } from "@tanstack/react-router";

/**
 * Automation worker. Called on a schedule by an external cron with the shared
 * secret in the x-cron-secret header. Two jobs:
 *   1. scan every brand website that is due and store new products/offers
 *   2. publish every queued item whose time has come and whose rendered image
 *      and social connection both exist
 * Nothing is ever marked published unless the platform accepted it.
 */

const DAY = 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/api/public/cron/automation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Called by the database scheduler with the project apikey, or by an
        // external scheduler with the shared secret. Either proves the caller.
        const apiKey = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
        const secret = process.env["CRON_SECRET"];
        const presentedKey = request.headers.get("apikey");
        const presentedSecret = request.headers.get("x-cron-secret");
        const authorized =
          (!!apiKey && presentedKey === apiKey) || (!!secret && presentedSecret === secret);
        if (!authorized) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { scanSite } = await import("@/lib/scan.server");
        const { publishToMeta, metaConfig } = await import("@/lib/publish.server");

        const report = { scanned: 0, discovered: 0, drafted: 0, published: 0, failed: 0 };
        const now = Date.now();

        /* ------------------------------ 1. scanning ----------------------------- */
        const { data: sites } = await supabaseAdmin
          .from("brand_websites")
          .select("*")
          .neq("scan_frequency", "off");

        for (const raw of sites ?? []) {
          const site = raw as unknown as {
            business_id: string;
            url: string;
            scan_frequency: string;
            auto_mode: string;
            default_template_id: string | null;
            post_time: string;
            timezone: string;
            platforms: string[] | null;
            last_scanned_at: string | null;
          };
          if (!site.url) continue;
          const interval = site.scan_frequency === "weekly" ? 7 * DAY : DAY;
          const last = site.last_scanned_at ? Date.parse(site.last_scanned_at) : 0;
          if (now - last < interval) continue;

          const { data: business } = await supabaseAdmin
            .from("businesses")
            .select("status, owner_id")
            .eq("id", site.business_id)
            .maybeSingle();
          const status = (business as { status?: string } | null)?.status;
          if (status === "rejected" || status === "suspended") continue;

          const result = await scanSite(site.url);
          report.scanned++;
          await supabaseAdmin
            .from("brand_websites")
            .update({ last_scanned_at: new Date().toISOString() } as never)
            .eq("business_id", site.business_id);
          if (result.error) continue;

          for (const item of result.items) {
            const { data: inserted } = await supabaseAdmin
              .from("discovered_items")
              .upsert(
                {
                  business_id: site.business_id,
                  source_url: item.sourceUrl,
                  fingerprint: item.fingerprint,
                  title: item.title,
                  description: item.description,
                  price: item.price,
                  currency: item.currency,
                  image_url: item.imageUrl,
                } as never,
                { onConflict: "business_id,fingerprint", ignoreDuplicates: true },
              )
              .select("id")
              .maybeSingle();
            const itemId = (inserted as { id?: string } | null)?.id;
            if (!itemId) continue;
            report.discovered++;

            if (site.auto_mode === "off" || !site.default_template_id) continue;

            // Automatic drafts reuse the brand's chosen template. The template
            // still owns the layout: only the text fields come from the website.
            const { data: post, error: postError } = await supabaseAdmin
              .from("posts")
              .insert({
                business_id: site.business_id,
                template_id: site.default_template_id,
                content: {
                  title: item.title,
                  business: "",
                  destination: "",
                  price: item.price,
                  additional: item.description.slice(0, 160),
                },
                caption: item.description.slice(0, 400),
                format: "post",
              } as never)
              .select("id")
              .maybeSingle();
            if (postError || !post) continue;
            const postId = (post as { id: string }).id;
            report.drafted++;
            await supabaseAdmin
              .from("discovered_items")
              .update({ status: "used", post_id: postId } as never)
              .eq("id", itemId);

            if (site.auto_mode !== "publish" || status !== "approved") continue;
            const [hours, minutes] = (site.post_time || "10:00").split(":");
            const when = new Date();
            when.setUTCDate(when.getUTCDate() + 1);
            when.setUTCHours(Number(hours ?? 10), Number(minutes ?? 0), 0, 0);
            for (const platform of site.platforms ?? []) {
              await supabaseAdmin.from("scheduled_posts").insert({
                business_id: site.business_id,
                post_id: postId,
                platform,
                scheduled_at: when.toISOString(),
                timezone: site.timezone || "UTC",
                note: "Created automatically from your website",
              } as never);
            }
          }
        }

        /* ----------------------------- 2. publishing ---------------------------- */
        if (metaConfig()) {
          const { data: due } = await supabaseAdmin
            .from("scheduled_posts")
            .select("*")
            .eq("status", "queued")
            .lte("scheduled_at", new Date().toISOString())
            .limit(25);

          for (const raw of due ?? []) {
            const item = raw as unknown as {
              id: string;
              business_id: string;
              post_id: string;
              platform: string;
            };
            const fail = async (reason: string) => {
              report.failed++;
              await supabaseAdmin
                .from("scheduled_posts")
                .update({ status: "failed", failure_reason: reason } as never)
                .eq("id", item.id);
            };

            if (item.platform !== "instagram" && item.platform !== "facebook") {
              await fail("Direct publishing is not available for this platform yet.");
              continue;
            }

            const { data: account } = await supabaseAdmin
              .from("social_oauth_accounts")
              .select("external_id, access_token")
              .eq("business_id", item.business_id)
              .eq("platform", item.platform)
              .maybeSingle();
            const token = account as { external_id: string; access_token: string } | null;
            if (!token) {
              await fail("This brand is not connected to that platform.");
              continue;
            }

            const { data: postRow } = await supabaseAdmin
              .from("posts")
              .select("render_path, caption")
              .eq("id", item.post_id)
              .maybeSingle();
            const post = postRow as { render_path: string | null; caption: string } | null;
            if (!post?.render_path) {
              await fail("The finished image is not ready yet. Open krijo24 to prepare it.");
              continue;
            }

            const { data: signed } = await supabaseAdmin.storage
              .from("rafty-media")
              .createSignedUrl(post.render_path, 3600);
            if (!signed?.signedUrl) {
              await fail("The finished image could not be read.");
              continue;
            }

            try {
              const remoteId = await publishToMeta({
                platform: item.platform,
                externalId: token.external_id,
                accessToken: token.access_token,
                imageUrl: signed.signedUrl,
                caption: post.caption ?? "",
              });
              await supabaseAdmin
                .from("scheduled_posts")
                .update({
                  status: "published",
                  remote_post_id: remoteId,
                  published_at: new Date().toISOString(),
                  failure_reason: null,
                } as never)
                .eq("id", item.id);
              report.published++;
            } catch (error) {
              await fail(error instanceof Error ? error.message.slice(0, 300) : "Publishing failed");
            }
          }
        }

        return Response.json(report);
      },
    },
  },
});
