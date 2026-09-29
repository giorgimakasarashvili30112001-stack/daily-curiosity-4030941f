import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

/**
 * Vite config for The Daily How (TanStack Start + Tailwind v4 + Nitro).
 *
 * Deploy target: the Nitro preset defaults to a plain Node server
 * (`npm run build && npm start`). Override it for other hosts with the
 * NITRO_PRESET env var at build time, e.g. `NITRO_PRESET=vercel npm run build`
 * or `NITRO_PRESET=cloudflare-module`.
 */
export default defineConfig(({ command, mode }) => {
  // Expose VITE_* variables to server code as well as the client bundle.
  const viteEnv = loadEnv(mode, process.cwd(), "VITE_");
  const define = Object.fromEntries(
    Object.entries(viteEnv).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]),
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
    server: { host: "::", port: 8080 },
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
