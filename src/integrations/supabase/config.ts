// Single place where Supabase settings are resolved for the whole app.
//
// Everything comes from the project's `.env` file (see `.env.example`):
//   - Server: read from process env at runtime (`SUPABASE_URL`, ...).
//   - Browser: `vite.config.ts` copies ONLY the two public values below into
//     the bundle as VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.
// The service-role key is never exposed to the browser; it is read in
// `client.server.ts` only.

/** Reads a runtime env var on the server; returns undefined in the browser. */
function runtimeEnv(key: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[key] : undefined;
}

/** Supabase project URL, e.g. https://xxxx.supabase.co */
export const SUPABASE_URL: string =
  runtimeEnv("SUPABASE_URL") || import.meta.env.VITE_SUPABASE_URL || "";

/** Public anon/publishable key (safe for the browser; protected by RLS). */
export const SUPABASE_PUBLISHABLE_KEY: string =
  runtimeEnv("SUPABASE_PUBLISHABLE_KEY") || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
