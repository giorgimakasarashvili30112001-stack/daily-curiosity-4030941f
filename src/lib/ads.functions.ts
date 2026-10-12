import { createServerFn } from "@tanstack/react-start";

/** Google's public test rewarded unit: safe to click, never earns or risks anything. */
const TEST_REWARDED_UNIT = "ca-app-pub-3940256099942544/5224354917";

/**
 * Returns the rewarded ad unit the app should load. Set ADMOB_REWARDED_AD_UNIT_ID in the
 * server environment; until then Google's test ad is used. Not secret (it ships in apps).
 */
export const getAdConfig = createServerFn({ method: "GET" }).handler(async () => {
  const unit = (process.env["ADMOB_REWARDED_AD_UNIT_ID"] ?? "").trim();
  return { adUnitId: unit || TEST_REWARDED_UNIT, isTesting: !unit };
});
