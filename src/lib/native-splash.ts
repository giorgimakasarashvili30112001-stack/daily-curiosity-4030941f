/**
 * native-splash.ts
 * ----------------
 * File-level: Hides the native (Capacitor) launch splash screen once the web
 * app has loaded. The splash covers the blank WebView while the site is being
 * fetched; it is kept visible until this is called, or until the safety timeout
 * in capacitor.config.ts (launchShowDuration) expires, so it can never get stuck.
 */
import { Capacitor } from "@capacitor/core";

let hidden = false;

/**
 * hideNativeSplash
 * Fades out the native splash screen. No-op in a normal browser, and safe to
 * call more than once.
 *
 * Params: none. Returns: resolves when done; never rejects (best-effort).
 * Side effects: asks the native Android/iOS layer to remove the splash overlay.
 */
export async function hideNativeSplash(): Promise<void> {
  if (hidden || typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  hidden = true;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch {
    // Best effort: the safety timeout will hide it if this fails.
  }
}
