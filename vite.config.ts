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
 * Vite inlines at build time. If those are absent while building, the bundle ships
 * with empty values and the deployed app throws "Missing Supabase environment
 * variable(s)" on first render — a blank error page that gives no hint the cause
 * was a build-time setting rather than a runtime one.
 *
 * Failing the build instead turns that into an obvious, actionable error.
 * Set ALLOW_MISSING_SUPABASE_ENV=1 to bypass (e.g. a docs-only preview build).
 */
function requireSupabaseEnv(): Plugin {
  return {
    name: "require-supabase-env",
    apply: "build",
    configResolved(config) {
      if (config.env["ALLOW_MISSING_SUPABASE_ENV"] || process.env["ALLOW_MISSING_SUPABASE_ENV"]) {
        return;
      }
      const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
      const missing = required.filter((key) => !config.env[key] && !process.env[key]);
      if (missing.length === 0) return;

      throw new Error(
        [
          "",
          "  Missing build-time environment variable(s): " + missing.join(", "),
          "",
          "  These are inlined into the browser bundle by Vite, so they must exist",
          "  when the build runs - not just at runtime. Without them the deployed",
          "  app renders a blank error page.",
          "",
          "  Locally:  cp .env.example .env  and fill it in.",
          "  On Vercel/Netlify: add them in the project's environment variables,",
          "  then redeploy (a restart is not enough - the values are baked in).",
          "",
        ].join("\n"),
      );
    },
  };
}

export default defineConfig({
  plugins: [requireSupabaseEnv()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
