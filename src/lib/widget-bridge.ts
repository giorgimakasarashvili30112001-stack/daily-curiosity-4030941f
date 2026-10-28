import { Capacitor, registerPlugin } from "@capacitor/core";

interface WidgetBridgePlugin {
  setStreak(options: { streak: number; date: string }): Promise<void>;
  clearStreak(): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>("WidgetBridge");

/** Hands the streak to the Android home-screen widget. No-op on web / old APKs. */
export async function syncWidgetStreak(streak: number | null): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("WidgetBridge")) return;
    if (streak === null || streak <= 0) await WidgetBridge.clearStreak();
    else await WidgetBridge.setStreak({ streak, date: new Date().toISOString().slice(0, 10) });
  } catch {
    // widget is a nice-to-have
  }
}
