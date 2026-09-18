/**
 * Real social publishing. Server only.
 *
 * Tokens live in public.social_oauth_accounts, a table no browser role can
 * read: only the service role reaches it. Instagram and Facebook publishing
 * goes through the Meta Graph API using the brand's own connected page.
 */

import { createHmac, timingSafeEqual } from "crypto";

/** Pinned by configuration rather than by this file, because Meta retires
 * versions on a schedule and the upgrade should not need a code change. */
const API_VERSION = process.env["META_API_VERSION"] || "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export type MetaConfig = { appId: string; appSecret: string };

export function metaConfig(): MetaConfig | null {
  const appId = process.env["META_APP_ID"];
  const appSecret = process.env["META_APP_SECRET"];
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

/**
 * The secret the OAuth state is signed with. Server only, never sent anywhere.
 *
 * It used to fall back to a constant when the environment was missing, which
 * meant a deployment without the service role key signed its state with a
 * string that is in this file - anyone could mint a state naming any brand and
 * have the callback attach their own Instagram token to it. There is no safe
 * default for this, so an install without the key cannot start the flow at all.
 */
function stateKey(): string {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Publishing is not configured.");
  return key;
}

/** Signed, short lived state so a callback cannot be pointed at another brand. */
export function signState(businessId: string, userId: string): string {
  const payload = `${businessId}.${userId}.${Date.now()}`;
  const sig = createHmac("sha256", stateKey()).update(payload).digest("hex").slice(0, 32);
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(state: string): { businessId: string; userId: string } | null {
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
  return `https://www.facebook.com/${API_VERSION}/dialog/oauth?${params.toString()}`;
}

type GraphError = { error?: { message?: string } };

/**
 * An error safe to write to a log.
 *
 * The token exchange puts the app secret and the authorization code in a query
 * string, and a network-level failure can carry the url it was attempting. So
 * nothing is logged as an object, only its message, and any query string in
 * that message is cut off: a log line is not worth the chance of printing the
 * secret that protects every connected account.
 */
export function safeMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/\?[^\s]*/g, "?<redacted>").slice(0, 300);
}

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
  /** The id publishing is addressed to: a Page id, or an Instagram user id. */
  externalId: string;
  accountLabel: string;
  username: string;
  profilePictureUrl: string | null;
  accessToken: string;
  /** When the token stops working, so the UI can ask for a reconnection before
   * a publish fails rather than after. Page tokens derived from a long lived
   * user token do not expire, and those report null. */
  expiresAt: string | null;
};

/** Exchanges the callback code for the brand's page and Instagram accounts. */
export async function exchangeMetaCode(code: string, redirectUri: string): Promise<MetaAccount[]> {
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

  const long = await graph<{ access_token: string; expires_in?: number }>(
    `/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: config.appId,
      client_secret: config.appSecret,
      fb_exchange_token: short.access_token,
    })}`,
  );

  // A page token derived from a long lived user token does not itself expire,
  // so the user token's expiry is the honest thing to record: it is the date
  // after which a reconnection will be needed.
  const expiresAt = long.expires_in
    ? new Date(Date.now() + long.expires_in * 1000).toISOString()
    : null;

  const pages = await graph<{
    data: {
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: {
        id: string;
        username?: string;
        profile_picture_url?: string;
      };
    }[];
  }>(
    `/me/accounts?fields=${encodeURIComponent(
      "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
    )}&access_token=${encodeURIComponent(long.access_token)}`,
  );

  if (!pages.data.length) {
    throw new Error("No Facebook page was found for this account.");
  }

  // Every page the person administers, not just the first. An agency running
  // several brands authorises once and picks the profile at publish time; the
  // old code took pages.data[0] and quietly made the rest unreachable.
  const accounts: MetaAccount[] = [];
  for (const page of pages.data) {
    accounts.push({
      platform: "facebook",
      externalId: page.id,
      accountLabel: page.name,
      username: page.name,
      profilePictureUrl: null,
      accessToken: page.access_token,
      expiresAt,
    });
    const ig = page.instagram_business_account;
    if (!ig?.id) continue;
    accounts.push({
      platform: "instagram",
      externalId: ig.id,
      accountLabel: ig.username ? `@${ig.username}` : page.name,
      username: ig.username ?? "",
      profilePictureUrl: ig.profile_picture_url ?? null,
      // Instagram publishing is addressed to the Instagram user id but
      // authorised by the token of the Page it is linked to.
      accessToken: page.access_token,
      expiresAt,
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
}): Promise<{ id: string; permalink: string | null }> {
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
    return { id: res.post_id ?? res.id ?? "", permalink: null };
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

  // The address of the post as a person would open it. Asked for separately
  // because media_publish returns only an id, and a failure here must not undo
  // a post that is already live - so the link is optional, not the result.
  let permalink: string | null = null;
  try {
    const media = await graph<{ permalink?: string }>(
      `/${published.id}?fields=permalink&access_token=${encodeURIComponent(input.accessToken)}`,
    );
    permalink = media.permalink ?? null;
  } catch {
    /* published either way; the history keeps the id */
  }
  return { id: published.id, permalink };
}
