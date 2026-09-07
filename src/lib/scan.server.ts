/**
 * Website scanning helpers. Server only.
 * Reads a brand's own public web pages and extracts product/offer facts.
 * Nothing here writes to the database and nothing trusts a client business id.
 */

export type ScannedItem = {
  sourceUrl: string;
  fingerprint: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  imageUrl: string | null;
};

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 9000;
const MAX_PAGES = 8;

const UA = "krijo24-scanner/1.0 (+https://krijo24.com)";

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.includes("html") && !type.includes("xml") && !type.includes("text")) {
      return null;
    }
    const text = await res.text();
    return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Very small robots.txt check for the default user agent. */
async function isAllowed(target: URL): Promise<boolean> {
  const robots = await fetchText(`${target.origin}/robots.txt`);
  if (!robots) return true;
  const lines = robots.split(/\r?\n/).map((l) => l.trim());
  let applies = false;
  const disallowed: string[] = [];
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = (rawKey ?? "").toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") applies = value === "*" || value.toLowerCase().includes("krijo24");
    else if (applies && key === "disallow" && value) disallowed.push(value);
  }
  const path = target.pathname || "/";
  return !disallowed.some((rule) => (rule === "/" ? true : path.startsWith(rule)));
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function clean(value: unknown, max = 400): string {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function meta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return clean(m[1]);
  }
  return "";
}

function absolute(base: string, value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function fingerprintOf(url: string, title: string): string {
  const raw = `${url}|${title}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  return `${new URL(url).pathname.slice(0, 80)}#${(hash >>> 0).toString(36)}`;
}

type JsonLdNode = Record<string, unknown>;

function jsonLdNodes(html: string): JsonLdNode[] {
  const out: JsonLdNode[] = [];
  const blocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks ?? []) {
    const body = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    try {
      const parsed = JSON.parse(body) as unknown;
      const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const node = queue.shift();
        if (!node || typeof node !== "object") continue;
        const record = node as JsonLdNode;
        out.push(record);
        for (const key of ["@graph", "itemListElement", "item", "hasOfferCatalog", "itemOffered"]) {
          const child = record[key];
          if (Array.isArray(child)) queue.push(...child);
          else if (child && typeof child === "object") queue.push(child);
        }
      }
    } catch {
      // A malformed block is skipped, the rest of the page still scans.
    }
  }
  return out;
}

function typeOf(node: JsonLdNode): string {
  const raw = node["@type"];
  if (Array.isArray(raw)) return raw.map((t) => String(t)).join(" ").toLowerCase();
  return String(raw ?? "").toLowerCase();
}

function offerOf(node: JsonLdNode): { price: string; currency: string } {
  const offers = node["offers"];
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const offer of list) {
    if (!offer || typeof offer !== "object") continue;
    const o = offer as JsonLdNode;
    const price = clean(o["price"] ?? o["lowPrice"] ?? "", 24);
    const currency = clean(o["priceCurrency"] ?? "", 8).toUpperCase();
    if (price) return { price: price.replace(/[^\d.,]/g, ""), currency };
  }
  const direct = clean(node["price"] ?? "", 24);
  return direct
    ? { price: direct.replace(/[^\d.,]/g, ""), currency: clean(node["priceCurrency"], 8) }
    : { price: "", currency: "" };
}

function imageOf(base: string, node: JsonLdNode): string | null {
  const raw = node["image"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first === "string") return absolute(base, first);
  if (first && typeof first === "object") {
    return absolute(base, clean((first as JsonLdNode)["url"], 500) || null);
  }
  return null;
}

/** Extracts every product/offer looking record from one HTML page. */
export function extractItems(html: string, pageUrl: string): ScannedItem[] {
  const items: ScannedItem[] = [];
  const seen = new Set<string>();

  for (const node of jsonLdNodes(html)) {
    const type = typeOf(node);
    const isItem = /product|offer|tour|trip|apartment|house|vehicle|car|event|service|room|menuitem/.test(
      type,
    );
    if (!isItem) continue;
    const title = clean(node["name"], 120);
    if (!title) continue;
    const url = absolute(pageUrl, clean(node["url"], 500)) ?? pageUrl;
    const { price, currency } = offerOf(node);
    const item: ScannedItem = {
      sourceUrl: url,
      fingerprint: fingerprintOf(url, title),
      title,
      description: clean(node["description"], 400),
      price,
      currency,
      imageUrl: imageOf(pageUrl, node),
    };
    if (seen.has(item.fingerprint)) continue;
    seen.add(item.fingerprint);
    items.push(item);
  }

  if (items.length === 0) {
    // Fall back to the page's own Open Graph / title data.
    const title =
      meta(html, "og:title") ||
      clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1], 120) ||
      clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 120);
    if (title) {
      const priceMatch = html.match(
        /(?:€|EUR|\$|£|CHF)\s?([0-9][0-9.,]{1,12})|([0-9][0-9.,]{1,12})\s?(?:€|EUR|CHF)/i,
      );
      const symbol = priceMatch?.[0]?.match(/€|EUR|\$|£|CHF/i)?.[0]?.toUpperCase() ?? "";
      items.push({
        sourceUrl: pageUrl,
        fingerprint: fingerprintOf(pageUrl, title),
        title,
        description: meta(html, "og:description") || meta(html, "description"),
        price: (priceMatch?.[1] ?? priceMatch?.[2] ?? "").replace(/[^\d.,]/g, ""),
        currency: symbol === "€" ? "EUR" : symbol === "$" ? "USD" : symbol === "£" ? "GBP" : symbol,
        imageUrl: absolute(pageUrl, meta(html, "og:image") || null),
      });
    }
  }

  return items;
}

const LIKELY = /(product|products|offer|offers|listing|listings|property|properties|tour|tours|package|packages|vehicle|car|cars|menu|shop|item|apartment|house|deal|deals)/i;

function sameOriginLinks(html: string, pageUrl: string): string[] {
  const origin = new URL(pageUrl).origin;
  const found = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const abs = absolute(pageUrl, match[1]);
    if (!abs || !abs.startsWith(origin)) continue;
    if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|mp4|css|js)(\?|$)/i.test(abs)) continue;
    if (abs.replace(/\/$/, "") === pageUrl.replace(/\/$/, "")) continue;
    if (!LIKELY.test(new URL(abs).pathname)) continue;
    found.add(abs.split("?")[0] as string);
  }
  return [...found].slice(0, MAX_PAGES);
}

/**
 * Scans one page and, when that page looks like a listing, a small number of
 * same origin detail pages. Bounded on purpose: a scan is fast and polite.
 */
export async function scanSite(startUrl: string): Promise<{
  items: ScannedItem[];
  pagesRead: number;
  error?: string;
}> {
  let target: URL;
  try {
    target = new URL(startUrl.startsWith("http") ? startUrl : `https://${startUrl}`);
  } catch {
    return { items: [], pagesRead: 0, error: "That does not look like a valid web address." };
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return { items: [], pagesRead: 0, error: "Only http and https addresses can be scanned." };
  }
  if (!(await isAllowed(target))) {
    return { items: [], pagesRead: 0, error: "This site's robots.txt does not allow scanning." };
  }

  const first = await fetchText(target.toString());
  if (!first) {
    return { items: [], pagesRead: 0, error: "That page could not be read." };
  }

  const collected = new Map<string, ScannedItem>();
  for (const item of extractItems(first, target.toString())) collected.set(item.fingerprint, item);
  let pagesRead = 1;

  if (collected.size < 3) {
    for (const link of sameOriginLinks(first, target.toString())) {
      const html = await fetchText(link);
      pagesRead++;
      if (!html) continue;
      for (const item of extractItems(html, link)) {
        if (!collected.has(item.fingerprint)) collected.set(item.fingerprint, item);
      }
      if (collected.size >= 12) break;
    }
  }

  return { items: [...collected.values()].slice(0, 24), pagesRead };
}
