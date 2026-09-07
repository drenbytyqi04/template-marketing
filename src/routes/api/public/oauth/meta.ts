import { createFileRoute } from "@tanstack/react-router";

/**
 * Meta OAuth callback. External caller, so the signed state is the only proof
 * of which brand this connection belongs to. Tokens are written with the
 * service role into a table no app user can read.
 */
export const Route = createFileRoute("/api/public/oauth/meta")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const back = (message: string) =>
          new Response(null, {
            status: 302,
            headers: { location: `/website?connect=${encodeURIComponent(message)}` },
          });

        if (!code || !state) return back("cancelled");

        const { verifyState, exchangeMetaCode } = await import("@/lib/publish.server");
        const parsed = verifyState(state);
        if (!parsed) return back("expired");

        try {
          const accounts = await exchangeMetaCode(code, `${url.origin}/api/public/oauth/meta`);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // The state proves membership at the moment the flow was started;
          // re-check it here so a replayed state cannot attach a token.
          const { data: member } = await supabaseAdmin
            .from("business_members")
            .select("business_id")
            .eq("business_id", parsed.businessId)
            .eq("user_id", parsed.userId)
            .maybeSingle();
          if (!member) return back("denied");

          for (const account of accounts) {
            await supabaseAdmin.from("social_oauth_accounts").upsert(
              {
                business_id: parsed.businessId,
                platform: account.platform,
                external_id: account.externalId,
                account_label: account.accountLabel,
                access_token: account.accessToken,
                scopes: "pages_manage_posts,instagram_content_publish",
              } as never,
              { onConflict: "business_id,platform" },
            );
            await supabaseAdmin.from("brand_social_connections").upsert(
              {
                business_id: parsed.businessId,
                platform: account.platform,
                status: "connected",
                account_label: account.accountLabel,
              } as never,
              { onConflict: "business_id,platform" },
            );
          }
          return back("connected");
        } catch (error) {
          console.error("[meta-oauth]", error);
          return back("failed");
        }
      },
    },
  },
});
