import type { CapacitorConfig } from "@capacitor/cli";

// Configuration comes from `.env` (see .env.example); real env vars win.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the real environment (e.g. CI).
}

/**
 * Native Android/iOS shell for the server-rendered app.
 * The shell loads the deployed site, so `webDir` only needs to exist.
 * APP_URL (in `.env`) is your deployed origin, e.g. https://dailyhow.example.com.
 */
const APP_URL = process.env["APP_URL"];
if (!APP_URL) {
  throw new Error("APP_URL is not set. Add it to .env (see .env.example) before syncing.");
}

const config: CapacitorConfig = {
  appId: "com.dailyhow.app",
  appName: "Daily How",

  // Not used for content (server.url wins), but Capacitor requires it to exist.
  webDir: "public",

  server: {
    url: APP_URL,
    androidScheme: "https",
    cleartext: false,
  },

  plugins: {
    // Launch splash: shown until the web app calls SplashScreen.hide()
    // (src/lib/native-splash.ts). launchShowDuration is only a safety cap so the
    // splash can never get stuck if the site is unreachable (e.g. offline).
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 10000,
      launchFadeOutDuration: 250,
      backgroundColor: "#090D15",
      androidScaleType: "CENTER_INSIDE",
    },
    // CapacitorHttp is intentionally OFF. When enabled it replaces fetch() so every
    // cross-origin request (all Supabase auth traffic) is routed through the native
    // Java layer instead of the WebView's faster network stack, slowing app start.
    // Not needed: the app loads from its own origin and Supabase allows CORS.
  },
};

export default config;
