import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Social connection RPCs.
 * The brand's stored tokens are never returned to the browser: the client only
 * learns whether a platform is connected and which account label is used.
 */

const businessInput = z.object({ businessId: z.string().uuid() });

/**
 * The one ownership check every handler here runs first.
 *
 * It queries with the caller's own client, so row level security applies on top
 * of the filter: a user who is not a member of the brand cannot read the
 * membership row that would prove they are.
 */
async function assertMember(
  supabase: SupabaseClient<Database>,
  businessId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("You do not have access to this brand.");
}

/**
 * Where Meta sends the person back.
 *
 * It has to match a Valid OAuth Redirect URI on the Meta app character for
 * character, so it is configurable: behind a proxy or a custom domain the
 * origin the server sees is not always the one the browser used, and Meta
 * rejects the mismatch. Left unset it is derived from the request, which is
 * what makes preview deployments work without registering each one.
 */
function callbackUrl(): string {
  const configured = process.env["META_REDIRECT_URI"];
  if (configured) return configured;
  const request = getRequest();
  const origin = new URL(request!.url).origin;
  return `${origin}/api/public/oauth/meta`;
}

/** Starts the Meta (Instagram + Facebook) connection for one brand. */
export const startMetaConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.businessId, context.userId);
    const { metaAuthUrl, signState } = await import("./publish.server");
    const url = metaAuthUrl(callbackUrl(), signState(data.businessId, context.userId));
    if (!url) {
      return {
        ok: false as const,
        error: "Direct publishing is not switched on for this krijo24 installation yet.",
      };
    }
    return { ok: true as const, url };
  });

/**
 * Forgets a connection.
 *
 * With an account id it drops that one profile, which is what a brand holding
 * several of them needs; without one it drops the whole platform. Either way
 * the token row is deleted rather than flagged: a token that is not stored
 * cannot be used, and that is a stronger guarantee than a status column.
 *
 * The publishing history is deliberately left alone. It records what was posted
 * and when, and disconnecting an account is not a reason to lose that.
 */
export const disconnectSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    businessInput
      .extend({
        platform: z.enum(["instagram", "facebook"]),
        accountId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.businessId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let remove = supabaseAdmin
      .from("social_oauth_accounts")
      .delete()
      .eq("business_id", data.businessId)
      .eq("platform", data.platform);
    // Scoped by business_id as well as by id, so an id from elsewhere deletes
    // nothing rather than someone else's connection.
    if (data.accountId) remove = remove.eq("id", data.accountId);
    await remove;

    // The platform reads as connected only while it still has an account.
    const { count } = await supabaseAdmin
      .from("social_oauth_accounts")
      .select("id", { count: "exact", head: true })
      .eq("business_id", data.businessId)
      .eq("platform", data.platform);
    if (!count) {
      await supabaseAdmin
        .from("brand_social_connections")
        .update({ status: "not_connected", account_label: "" } as never)
        .eq("business_id", data.businessId)
        .eq("platform", data.platform);
    }
    console.info(
      `[social] disconnected business=${data.businessId} platform=${data.platform}` +
        (data.accountId ? ` account=${data.accountId}` : " (all)"),
    );
    return { ok: true as const };
  });

/** Whether this krijo24 installation can publish at all, for honest UI copy. */
export const publishingAvailable = createServerFn({ method: "GET" }).handler(async () => {
  const { metaConfig } = await import("./publish.server");
  return { available: metaConfig() !== null };
});

/* --------------------------- publishing from the app ---------------------- */

/**
 * The connected accounts a brand can publish to.
 *
 * Deliberately narrow: the row holds an access token, and the browser has no
 * use for it, so the select names the safe columns rather than taking the row
 * and deleting fields from it. A column added to that table later cannot leak
 * through this by accident.
 */
export const listSocialAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.businessId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("social_oauth_accounts")
      .select("id, platform, external_id, account_label, username, profile_picture_url, expires_at")
      .eq("business_id", data.businessId)
      .order("platform");

    const now = Date.now();
    return {
      accounts: (rows ?? []).map((row) => {
        const account = row as {
          id: string;
          platform: "instagram" | "facebook";
          account_label: string;
          username: string;
          profile_picture_url: string | null;
          expires_at: string | null;
        };
        return {
          id: account.id,
          platform: account.platform,
          label: account.account_label,
          username: account.username,
          profilePictureUrl: account.profile_picture_url,
          // A token past its date still looks connected, and the publish would
          // fail at the last step. Saying so here lets the UI offer a
          // reconnection before someone writes a caption.
          needsReconnect: !!account.expires_at && Date.parse(account.expires_at) < now,
        };
      }),
    };
  });

const publishInput = businessInput.extend({
  postId: z.string().uuid(),
  accountId: z.string().uuid(),
  caption: z.string().max(2200),
});

/**
 * Publishes a saved post to one connected account, now.
 *
 * Everything the browser sends is an identifier, and every one of them is
 * checked against the signed-in user before it is used: the brand, the post
 * and the account must all belong together, or nothing happens. The token is
 * read with the service role inside this handler and never leaves it.
 */
export const publishNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => publishInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.businessId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { publishToMeta, metaConfig } = await import("./publish.server");

    if (!metaConfig()) {
      return { ok: false as const, error: "Instagram publishing is not configured." };
    }

    // The account has to be this brand's. Filtering by business_id rather than
    // looking the account up by id alone is what stops one brand publishing
    // through another's token by guessing an id.
    const { data: accountRow } = await supabaseAdmin
      .from("social_oauth_accounts")
      .select("id, platform, external_id, account_label, access_token, expires_at")
      .eq("id", data.accountId)
      .eq("business_id", data.businessId)
      .maybeSingle();
    const account = accountRow as {
      id: string;
      platform: "instagram" | "facebook";
      external_id: string;
      account_label: string;
      access_token: string;
      expires_at: string | null;
    } | null;
    if (!account) {
      return { ok: false as const, error: "That account is not connected to this brand." };
    }
    if (account.expires_at && Date.parse(account.expires_at) < Date.now()) {
      return { ok: false as const, error: "reconnect" };
    }

    // Same check for the post.
    const { data: postRow } = await supabaseAdmin
      .from("posts")
      .select("id, render_path")
      .eq("id", data.postId)
      .eq("business_id", data.businessId)
      .maybeSingle();
    const post = postRow as { id: string; render_path: string | null } | null;
    if (!post) {
      return { ok: false as const, error: "That post does not belong to this brand." };
    }
    if (!post.render_path) {
      return {
        ok: false as const,
        error: "The finished image is still being prepared. Save the post again and retry.",
      };
    }

    // Publishing twice produces two posts on Instagram and no way to undo the
    // second, so a post already published to this account is refused rather
    // than retried. This is the only guard that matters more than convenience.
    const { data: already } = await supabaseAdmin
      .from("social_publications")
      .select("id, external_post_id")
      .eq("post_id", data.postId)
      .eq("social_account_id", data.accountId)
      .eq("status", "published")
      .maybeSingle();
    if (already) {
      return {
        ok: false as const,
        error: "This post has already been published to that account.",
      };
    }

    const { data: inserted } = await supabaseAdmin
      .from("social_publications")
      .insert({
        business_id: data.businessId,
        post_id: data.postId,
        social_account_id: data.accountId,
        platform: account.platform,
        account_label: account.account_label,
        caption: data.caption,
        media_path: post.render_path,
        status: "publishing",
      } as never)
      .select("id")
      .maybeSingle();
    const publication = inserted as { id: string } | null;

    const finish = async (patch: Record<string, unknown>) => {
      if (!publication) return;
      await supabaseAdmin
        .from("social_publications")
        .update(patch as never)
        .eq("id", publication.id);
    };

    try {
      // Meta fetches the image from this url with its own servers, so it has to
      // be reachable without the user's session. A signed url keeps the bucket
      // private and expires an hour after the post goes out.
      const { data: signed } = await supabaseAdmin.storage
        .from("rafty-media")
        .createSignedUrl(post.render_path, 3600);
      if (!signed?.signedUrl) throw new Error("The finished image could not be read.");

      const result = await publishToMeta({
        platform: account.platform,
        externalId: account.external_id,
        accessToken: account.access_token,
        imageUrl: signed.signedUrl,
        caption: data.caption,
      });

      await finish({
        status: "published",
        external_post_id: result.id,
        published_at: new Date().toISOString(),
        error_message: null,
      });
      console.info(
        `[publish] ok business=${data.businessId} platform=${account.platform} post=${data.postId}`,
      );
      return {
        ok: true as const,
        externalPostId: result.id,
        permalink: result.permalink,
        accountLabel: account.account_label,
      };
    } catch (error) {
      // The reason is written down for support and kept away from the person,
      // who cannot act on a Graph API error string.
      const { safeMessage } = await import("./publish.server");
      const reason = safeMessage(error);
      await finish({ status: "failed", error_message: reason });
      console.error(
        `[publish] failed business=${data.businessId} platform=${account.platform}: ${reason}`,
      );
      return { ok: false as const, error: "We could not publish this post. Please try again." };
    }
  });

/** The brand's publishing history, newest first. */
export const listPublications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.businessId, context.userId);
    const { data: rows } = await context.supabase
      .from("social_publications")
      .select(
        "id, platform, account_label, external_post_id, caption, status, error_message, published_at, created_at, post_id",
      )
      .eq("business_id", data.businessId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { publications: rows ?? [] };
  });
