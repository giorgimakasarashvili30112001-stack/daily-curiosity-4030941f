/**
 * rewarded-ad.ts
 * --------------
 * Shows an AdMob rewarded video in the Android app. The reward itself (+3 coins) is NOT
 * granted here: Google calls our server (/api/public/admob-ssv) with a signed confirmation,
 * so the balance cannot be faked from the client. This only plays the ad.
 */
import { Capacitor } from "@capacitor/core";

export const REWARD_COINS = 3;

export type AdResult = "rewarded" | "closed" | "unavailable";

/** Ads only run inside the native app. */
export function adsSupported(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

let initialized = false;

/**
 * Plays one rewarded ad for `userId`. Resolves "rewarded" once the viewer earned it,
 * "closed" if they quit early, "unavailable" if no ad could be loaded.
 */
export async function playRewardedAd(
  userId: string,
  adUnitId: string,
  isTesting: boolean,
): Promise<AdResult> {
  const { AdMob, AdmobConsentStatus, RewardAdPluginEvents } =
    await import("@capacitor-community/admob");

  if (!initialized) {
    // EU/UK: ask for consent before requesting ads (Google's UMP form).
    try {
      const info = await AdMob.requestConsentInfo();
      if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
        await AdMob.showConsentForm();
      }
    } catch {
      // Consent info unavailable: continue, the SDK will not serve personalised ads without it.
    }
    await AdMob.initialize();
    initialized = true;
  }

  const handles: { remove: () => Promise<void> }[] = [];
  try {
    await AdMob.prepareRewardVideoAd({
      adId: adUnitId,
      isTesting,
      ssv: { userId, customData: crypto.randomUUID() },
    });
  } catch {
    return "unavailable";
  }

  return new Promise<AdResult>((resolve) => {
    let rewarded = false;
    void (async () => {
      handles.push(
        await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
          rewarded = true;
        }),
        await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
          void Promise.all(handles.map((h) => h.remove())).finally(() =>
            resolve(rewarded ? "rewarded" : "closed"),
          );
        }),
        await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
          void Promise.all(handles.map((h) => h.remove())).finally(() => resolve("unavailable"));
        }),
      );
      try {
        await AdMob.showRewardVideoAd();
      } catch {
        resolve("unavailable");
      }
    })();
  });
}
