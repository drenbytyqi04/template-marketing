/**
 * Real social publishing. Server only.
 *
 * Tokens live in public.social_oauth_accounts, a table no browser role can
 * read: only the service role reaches it. Instagram and Facebook publishing
 * goes through the Meta Graph API using the brand's own connected page.
 */

import { createHmac, timingSafeEqual } from "crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

export type MetaConfig = { appId: string; appSecret: string };

export function metaConfig(): MetaConfig | null {
  const appId = process.env["META_APP_ID"];
  const appSecret = process.env["META_APP_SECRET"];
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

function stateKey(): string {
  // Server only secret, never sent to a browser.
  return process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "krijo24-dev";
}

/** Signed, short lived state so a callback cannot be pointed at another brand. */
export function signState(businessId: string, userId: string): string {
  const payload = `${businessId}.${userId}.${Date.now()}`;
  const sig = createHmac("sha256", stateKey()).update(payload).digest("hex").slice(0, 32);
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(
  state: string,
): { businessId: string; userId: string } | null {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString();
  } catch {
    return null;
  }
  const expected = createHmac("sha256", stateKey()).update(payload).digest("hex").slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [businessId, userId, issued] = payload.split(".");
  if (!businessId || !userId || !issued) return null;
  if (Date.now() - Number(issued) > 15 * 60 * 1000) return null;
  return { businessId, userId };
}

export function metaAuthUrl(redirectUri: string, state: string): string | null {
  const config = metaConfig();
  if (!config) return null;
  const scopes = [
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
  ].join(",");
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: scopes,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

type GraphError = { error?: { message?: string } };

async function graph<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, init);
  const body = (await res.json()) as T & GraphError;
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? `Meta request failed (${res.status})`);
  }
  return body;
}

export type MetaAccount = {
  platform: "facebook" | "instagram";
  externalId: string;
  accountLabel: string;
  accessToken: string;
};

/** Exchanges the callback code for the brand's page and Instagram accounts. */
export async function exchangeMetaCode(
  code: string,
  redirectUri: string,
): Promise<MetaAccount[]> {
  const config = metaConfig();
  if (!config) throw new Error("Publishing is not configured.");

  const short = await graph<{ access_token: string }>(
    `/oauth/access_token?${new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: redirectUri,
      code,
    })}`,
  );

  const long = await graph<{ access_token: string }>(
    `/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: config.appId,
      client_secret: config.appSecret,
      fb_exchange_token: short.access_token,
    })}`,
  );

  const pages = await graph<{
    data: {
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }[];
  }>(
    `/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(long.access_token)}`,
  );

  const page = pages.data[0];
  if (!page) throw new Error("No Facebook page was found for this account.");

  const accounts: MetaAccount[] = [
    {
      platform: "facebook",
      externalId: page.id,
      accountLabel: page.name,
      accessToken: page.access_token,
    },
  ];
  if (page.instagram_business_account?.id) {
    accounts.push({
      platform: "instagram",
      externalId: page.instagram_business_account.id,
      accountLabel: page.instagram_business_account.username
        ? `@${page.instagram_business_account.username}`
        : page.name,
      accessToken: page.access_token,
    });
  }
  return accounts;
}

/** Publishes one image with a caption. Returns the remote post id. */
export async function publishToMeta(input: {
  platform: "facebook" | "instagram";
  externalId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<string> {
  if (input.platform === "facebook") {
    const res = await graph<{ id?: string; post_id?: string }>(`/${input.externalId}/photos`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        url: input.imageUrl,
        caption: input.caption.slice(0, 5000),
        access_token: input.accessToken,
      }),
    });
    return res.post_id ?? res.id ?? "";
  }

  const container = await graph<{ id: string }>(`/${input.externalId}/media`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      image_url: input.imageUrl,
      caption: input.caption.slice(0, 2200),
      access_token: input.accessToken,
    }),
  });

  // Instagram needs the container to finish processing before publishing.
  for (let attempt = 0; attempt < 10; attempt++) {
    const status = await graph<{ status_code?: string }>(
      `/${container.id}?fields=status_code&access_token=${encodeURIComponent(input.accessToken)}`,
    );
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR") throw new Error("Instagram could not process the image.");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const published = await graph<{ id: string }>(`/${input.externalId}/media_publish`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: container.id,
      access_token: input.accessToken,
    }),
  });
  return published.id;
}
