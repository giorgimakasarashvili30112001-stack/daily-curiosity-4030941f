/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Injected at build time from SUPABASE_URL in .env (see vite.config.ts). */
  readonly VITE_SUPABASE_URL?: string;
  /** Injected at build time from SUPABASE_PUBLISHABLE_KEY in .env (see vite.config.ts). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
