// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

/**
 * The browser bundle reads Supabase config through `import.meta.env.VITE_*`, which
 * Vite inlines at BUILD time - a host that sets them only at runtime produces a
 * bundle with empty values.
 *
 * That is no longer fatal: src/integrations/supabase/config.ts falls back to the
 * project's public URL and publishable key. This warning exists so the situation is
 * still visible in build logs rather than silently shipping the fallback.
 */
function warnMissingSupabaseEnv(): Plugin {
  return {
    name: "warn-missing-supabase-env",
    apply: "build",
    configResolved(config) {
      const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
      const missing = required.filter((key) => !config.env[key] && !process.env[key]);
      if (missing.length === 0) return;

      config.logger.warn(
        [
          "",
          "  [supabase] Building without: " + missing.join(", "),
          "  Falling back to the values baked into src/integrations/supabase/config.ts.",
          "  Set these in the host's environment variables to target another project.",
          "",
        ].join("\n"),
      );
    },
  };
}

export default defineConfig({
  plugins: [warnMissingSupabaseEnv()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
