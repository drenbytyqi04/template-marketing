/**
 * Supabase connection settings.
 *
 * These two values are public by design: the publishable key is meant to reach
 * the browser and every table it can touch is guarded by row level security. They
 * are shipped in the client bundle either way, so baking in a fallback leaks
 * nothing that the bundle did not already expose.
 *
 * The fallback exists because Vite inlines `import.meta.env.VITE_*` at BUILD time.
 * A host that has the variables set at runtime but not during the build produces a
 * bundle with empty values, and the app dies on first render with no useful error.
 * Falling back here means the app boots on any host, configured or not.
 *
 * Environment always wins, so pointing a deployment at a different project stays a
 * config change rather than a code change.
 *
 * NOTE: the service role key is NOT here and must never be. It bypasses row level
 * security, so it stays server-only and env-only (see client.server.ts).
 */
const FALLBACK_URL = "https://evspytufythlndhxudez.supabase.co";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_hVismTTL0U6-0B6y5v17Qw_w-dK6gei";

/** Reads an env var from whichever side of the render this runs on. */
function fromEnv(viteKey: string, nodeKey: string): string | undefined {
  const fromVite =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env[viteKey] as string | undefined)
      : undefined;
  if (fromVite) return fromVite;
  return typeof process !== "undefined" && process.env ? process.env[nodeKey] : undefined;
}

export const supabaseUrl = (): string =>
  fromEnv("VITE_SUPABASE_URL", "SUPABASE_URL") || FALLBACK_URL;

export const supabasePublishableKey = (): string =>
  fromEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY") || FALLBACK_PUBLISHABLE_KEY;

/** New-style Supabase keys are opaque strings, not bearer JWTs. */
export function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}
