import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native Android/iOS shell for the server-rendered app.
 * The shell loads the deployed site, so `webDir` only needs to exist.
 * Set APP_URL to your deployed origin (e.g. https://dailyhow.example.com)
 * before running `npx cap sync`.
 */
const APP_URL = process.env["APP_URL"] ?? "https://YOUR-DOMAIN";

const config: CapacitorConfig = {
  appId: "com.dailyhow.app",
  appName: "The Daily How",

  // Not used for content (server.url wins), but Capacitor requires it to exist.
  webDir: "public",

  server: {
    url: APP_URL,
    androidScheme: "https",
    cleartext: false,
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#1a1a1a",
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
