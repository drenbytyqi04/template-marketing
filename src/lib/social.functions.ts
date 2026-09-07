import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Social connection RPCs.
 * The brand's stored tokens are never returned to the browser: the client only
 * learns whether a platform is connected and which account label is used.
 */

const businessInput = z.object({ businessId: z.string().uuid() });

async function assertMember(supabase: any, businessId: string, userId: string) {
  const { data } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("You do not have access to this brand.");
}

function callbackUrl(): string {
  const request = getRequest();
  const origin = new URL(request!.url).origin;
  return `${origin}/api/public/oauth/meta`;
}

/** Starts the Meta (Instagram + Facebook) connection for one brand. */
export const startMetaConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
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

export const disconnectSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ platform: z.enum(["instagram", "facebook"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.businessId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("social_oauth_accounts")
      .delete()
      .eq("business_id", data.businessId)
      .eq("platform", data.platform);
    await supabaseAdmin
      .from("brand_social_connections")
      .update({ status: "not_connected", account_label: "" } as never)
      .eq("business_id", data.businessId)
      .eq("platform", data.platform);
    return { ok: true as const };
  });

/** Whether this krijo24 installation can publish at all, for honest UI copy. */
export const publishingAvailable = createServerFn({ method: "GET" }).handler(async () => {
  const { metaConfig } = await import("./publish.server");
  return { available: metaConfig() !== null };
});
