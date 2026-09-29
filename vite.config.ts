import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// `.env` is the single source of configuration (see .env.example). Load it into
// process.env so server code sees it in dev too. Real environment variables
// (e.g. set on your host) always win over the file.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the real environment.
}

/**
 * Vite config for The Daily How (TanStack Start + Tailwind v4 + Nitro).
 *
 * Deploy target: the Nitro preset defaults to a plain Node server
 * (`npm run build && npm start`). Override it with NITRO_PRESET in `.env`,
 * e.g. `vercel`, `netlify` or `cloudflare-module`.
 */
export default defineConfig(({ command }) => {
  // Only these two PUBLIC values reach the browser bundle. Secrets such as
  // SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY are deliberately not listed.
  const publicEnv: Record<string, string | undefined> = {
    VITE_SUPABASE_URL: process.env["SUPABASE_URL"],
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env["SUPABASE_PUBLISHABLE_KEY"],
  };
  const define = Object.fromEntries(
    Object.entries(publicEnv)
      .filter(([, value]) => !!value)
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {
    define,
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    },
    server: { port: 8080 },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        server: { entry: "server" },
      }),
      ...(command === "build" ? [nitro({ preset: process.env["NITRO_PRESET"] ?? "node-server" })] : []),
      viteReact(),
    ],
  };
});
