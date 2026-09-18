import { createFileRoute } from "@tanstack/react-router";

/**
 * Meta OAuth callback. External caller, so the signed state is the only proof
 * of which brand this connection belongs to. Tokens are written with the
 * service role into a table no app user can read.
 */
/** What the connect flow asks Meta for. Kept beside the callback so the scopes
 * recorded on the stored account are the ones actually granted. */
const SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

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
                username: account.username,
                profile_picture_url: account.profilePictureUrl,
                access_token: account.accessToken,
                expires_at: account.expiresAt,
                scopes: SCOPES.join(","),
              } as never,
              // On the account's own id, so re-authorising refreshes the row it
              // already has rather than adding a second one, while a brand may
              // still hold several profiles on the same platform.
              { onConflict: "business_id,platform,external_id" },
            );
          }

          // One connection row per platform, reflecting whichever accounts came
          // back. It is what the settings screen reads; the accounts themselves
          // are listed from the table above.
          for (const platform of ["facebook", "instagram"] as const) {
            const first = accounts.find((a) => a.platform === platform);
            if (!first) continue;
            const others = accounts.filter((a) => a.platform === platform).length - 1;
            await supabaseAdmin.from("brand_social_connections").upsert(
              {
                business_id: parsed.businessId,
                platform,
                status: "connected",
                account_label: others > 0 ? `${first.accountLabel} +${others}` : first.accountLabel,
              } as never,
              { onConflict: "business_id,platform" },
            );
          }

          const instagram = accounts.filter((a) => a.platform === "instagram").length;
          console.info(
            `[meta-oauth] connected business=${parsed.businessId} pages=${
              accounts.length - instagram
            } instagram=${instagram}`,
          );
          if (!instagram) return back("no-instagram");
          return back("connected");
        } catch (error) {
          const { safeMessage } = await import("@/lib/publish.server");
          console.error(`[meta-oauth] ${safeMessage(error)}`);
          return back("failed");
        }
      },
    },
  },
});
