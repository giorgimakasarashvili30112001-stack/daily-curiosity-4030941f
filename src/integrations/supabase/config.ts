// Single place where Supabase settings are resolved for the whole app.
//
// Everything comes from the project's `.env` (local) or the host's environment
// variables (production, e.g. Cloudflare). Values are resolved at CALL time,
// not import time, because platforms like Cloudflare Workers only expose env
// vars while a request is being handled.
//
// Resolution order:
//   1. Server runtime env (`process.env.SUPABASE_URL`, ...)
//   2. Browser: values injected into the HTML by the server (`window.__PUBLIC_CONFIG__`),
//      so runtime-only variables work without a rebuild
//   3. Values baked in at build time by vite.config.ts (VITE_SUPABASE_*)
//
// Only the two PUBLIC values are ever sent to the browser. The service-role key
// is read in `client.server.ts` only.

interface PublicConfig {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
}

declare global {
  interface Window {
    __PUBLIC_CONFIG__?: PublicConfig;
  }
}

/** Reads a runtime env var on the server; returns undefined in the browser. */
function runtimeEnv(key: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[key] : undefined;
}

/** Config the server injected into the page (browser only). */
function injected(): PublicConfig | undefined {
  return typeof window !== "undefined" ? window.__PUBLIC_CONFIG__ : undefined;
}

/** Supabase project URL, e.g. https://xxxx.supabase.co */
export function getSupabaseUrl(): string {
  return (
    runtimeEnv("SUPABASE_URL") || injected()?.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || ""
  );
}

/** Public anon/publishable key (safe for the browser; protected by RLS). */
export function getSupabasePublishableKey(): string {
  return (
    runtimeEnv("SUPABASE_PUBLISHABLE_KEY") ||
    injected()?.SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

/**
 * Inline <script> body that hands the two public values to the browser.
 * Runs on the server while rendering (real values) and on the client during
 * hydration (re-serializes what the server injected so markup matches).
 * `<` is escaped so the JSON can never close the script tag.
 */
export function publicConfigScript(): string {
  const config: PublicConfig =
    typeof window === "undefined"
      ? { SUPABASE_URL: getSupabaseUrl(), SUPABASE_PUBLISHABLE_KEY: getSupabasePublishableKey() }
      : { SUPABASE_URL: injected()?.SUPABASE_URL ?? "", SUPABASE_PUBLISHABLE_KEY: injected()?.SUPABASE_PUBLISHABLE_KEY ?? "" };
  return `window.__PUBLIC_CONFIG__=${JSON.stringify(config).replace(/</g, "\\u003c")};`;
}
