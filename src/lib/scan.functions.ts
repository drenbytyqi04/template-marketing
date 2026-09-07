import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Website scanning RPCs.
 * Ownership is always re-checked server side against the caller's memberships:
 * a business id from the browser is a request, never a proof of access.
 */

const businessInput = z.object({ businessId: z.string().uuid() });

const scanInput = businessInput.extend({
  url: z.string().trim().min(4).max(500),
});

async function assertMember(
  supabase: { from: (t: "business_members") => any },
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

export const scanBrandWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scanInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase as never, data.businessId, userId);

    const { scanSite } = await import("./scan.server");
    const result = await scanSite(data.url);
    if (result.error) return { ok: false as const, error: result.error, added: 0, found: 0 };

    let added = 0;
    for (const item of result.items) {
      const { error } = await supabase.from("discovered_items").upsert(
        {
          business_id: data.businessId,
          source_url: item.sourceUrl,
          fingerprint: item.fingerprint,
          title: item.title,
          description: item.description,
          price: item.price,
          currency: item.currency,
          image_url: item.imageUrl,
        } as never,
        { onConflict: "business_id,fingerprint", ignoreDuplicates: true },
      );
      if (!error) added++;
    }

    await supabase
      .from("brand_websites")
      .upsert(
        {
          business_id: data.businessId,
          url: data.url,
          last_scanned_at: new Date().toISOString(),
        } as never,
        { onConflict: "business_id" },
      );

    return { ok: true as const, added, found: result.items.length, pagesRead: result.pagesRead };
  });

/**
 * Returns a discovered item's picture as a data url so the browser can use it
 * as the single post image. Done server side because most shops block
 * cross origin reads from a browser.
 */
export const fetchDiscoveredImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ itemId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase as never, data.businessId, userId);

    const { data: row } = await supabase
      .from("discovered_items")
      .select("image_url")
      .eq("id", data.itemId)
      .eq("business_id", data.businessId)
      .maybeSingle();

    const url = (row as { image_url: string | null } | null)?.image_url;
    if (!url) return { ok: false as const, error: "This item has no picture." };

    try {
      const res = await fetch(url, { headers: { "user-agent": "krijo24-scanner/1.0" } });
      if (!res.ok) return { ok: false as const, error: "The picture could not be downloaded." };
      const type = res.headers.get("content-type") ?? "image/jpeg";
      if (!type.startsWith("image/")) {
        return { ok: false as const, error: "That link is not a picture." };
      }
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > 8_000_000) {
        return { ok: false as const, error: "That picture is too large." };
      }
      const base64 = Buffer.from(buffer).toString("base64");
      return { ok: true as const, dataUrl: `data:${type};base64,${base64}` };
    } catch {
      return { ok: false as const, error: "The picture could not be downloaded." };
    }
  });
