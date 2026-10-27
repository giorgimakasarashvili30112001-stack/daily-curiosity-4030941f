import { Capacitor } from "@capacitor/core";

export const REMINDER_PREF_KEY = "the-daily-how-reminders-enabled";

/** Local times (24h) the reminders fire on the device. */
const SLOTS = [11, 19] as const;
/** How many days ahead we keep notifications scheduled. */
const DAYS_AHEAD = 14;

export type ReminderStatus =
  | "unsupported" // running in a browser, not the native app
  | "denied" // blocked in system settings
  | "ready";

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function readReminderPref(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(REMINDER_PREF_KEY) === "true";
}

const DONE_KEY = "daily-how-quiz-done-date";

/** Remembers (on this device) the local date the daily streak was earned. */
function readDoneDate(): string | null {
  try {
    return localStorage.getItem(DONE_KEY);
  } catch {
    return null;
  }
}
function writeDoneDate(key: string): void {
  try {
    localStorage.setItem(DONE_KEY, key);
  } catch {
    // storage unavailable: reminders just stay scheduled
  }
}

export function writeReminderPref(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(REMINDER_PREF_KEY, enabled ? "true" : "false");
}

async function plugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

/** Stable id per day-slot so re-scheduling replaces instead of duplicating. */
function notificationId(date: Date, hour: number): number {
  const day = Math.floor(date.getTime() / 86_400_000);
  return day * 10 + (hour === SLOTS[0] ? 1 : 2);
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const BODIES: Record<number, { title: string; body: string }> = {
  11: { title: "Your daily how is waiting", body: "Take a look at today's fact." },
  19: { title: "Still time for today's how", body: "One quick read, one quick question." },
};

export async function ensurePermission(): Promise<ReminderStatus> {
  if (!isNativeApp()) return "unsupported";
  const LocalNotifications = await plugin();
  let { display } = await withTimeout(LocalNotifications.checkPermissions(), 8000).catch(
    (error: Error) => {
      throw new Error(
        `the phone did not answer the notification permission check (${error.message})`,
      );
    },
  );
  if (display === "prompt" || display === "prompt-with-rationale") {
    ({ display } = await LocalNotifications.requestPermissions());
  }
  return display === "granted" ? "ready" : "denied";
}

export async function cancelDailyReminders(): Promise<void> {
  if (!isNativeApp()) return;
  const LocalNotifications = await plugin();
  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length) {
    await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  }
}

/**
 * Keeps the 11:00 / 19:00 reminders in sync with the user's progress.
 * Today's remaining reminders are dropped once today's streak is earned.
 */
export async function syncDailyReminders(options: {
  enabled: boolean;
  /** Local date (YYYY-MM-DD) of the last correct answer, if any. */
  lastCorrectDate?: string | null;
}): Promise<ReminderStatus> {
  if (!isNativeApp()) return "unsupported";

  if (!options.enabled) {
    await cancelDailyReminders();
    return "ready";
  }

  const status = await ensurePermission();
  if (status !== "ready") {
    await cancelDailyReminders();
    return status;
  }

  const LocalNotifications = await plugin();
  await cancelDailyReminders();

  const now = new Date();
  const todayKey = localDateKey(now);
  if (options.lastCorrectDate === todayKey) writeDoneDate(todayKey);
  const doneToday = options.lastCorrectDate === todayKey || readDoneDate() === todayKey;

  const scheduled: Array<{
    id: number;
    title: string;
    body: string;
    schedule: { at: Date; allowWhileIdle: boolean };
    smallIcon: string;
    iconColor: string;
    isExactNotification: boolean;
  }> = [];

  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    if (offset === 0 && doneToday) continue;

    for (const hour of SLOTS) {
      const at = new Date(day);
      at.setHours(hour, 0, 0, 0);
      if (at.getTime() <= now.getTime()) continue;
      const copy = BODIES[hour]!;
      scheduled.push({
        id: notificationId(day, hour),
        title: copy.title,
        body: copy.body,
        schedule: { at, allowWhileIdle: true },
        // Inexact: this plugin defaults to exact alarms, which on Android 12+ opens a system
        // "Alarms & reminders" screen. A reminder a few minutes late is fine.
        isExactNotification: false,
        smallIcon: "ic_stat_notify",
        iconColor: "#F4A93C",
      });
    }
  }

  if (scheduled.length) {
    await LocalNotifications.schedule({ notifications: scheduled });
  }
  return "ready";
}

/**
 * Re-arms the reminders without needing the Profile page: call on app start and on resume.
 * Does nothing unless the user turned reminders on. Keeps the 14-day window topped up.
 */
export async function refreshRemindersIfEnabled(): Promise<void> {
  if (!isNativeApp() || !readReminderPref()) return;
  try {
    await syncDailyReminders({ enabled: true });
  } catch {
    // best effort
  }
}

/** The last error seen while changing reminders (kept in memory for the status check). */
let lastError: string | null = null;
export function rememberReminderError(error: unknown): void {
  lastError = (error as Error)?.message ?? String(error);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no answer after ${ms / 1000}s`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** One-line description of what the app sees on this device, for troubleshooting. */
export async function getReminderDiagnostics(): Promise<string> {
  const parts: string[] = [];
  parts.push(isNativeApp() ? "installed app" : "browser (reminders unsupported)");
  parts.push(`saved choice: ${readReminderPref() ? "on" : "off"}`);
  if (isNativeApp()) {
    parts.push(`platform: ${Capacitor.getPlatform()}`);
    parts.push(
      `plugin registered: ${Capacitor.isPluginAvailable("LocalNotifications") ? "yes" : "NO"}`,
    );
    parts.push(`site: ${typeof location !== "undefined" ? location.origin : "?"}`);
    let LocalNotifications: Awaited<ReturnType<typeof plugin>> | null = null;
    try {
      LocalNotifications = await withTimeout(plugin(), 4000);
    } catch (error) {
      parts.push(`load plugin: ${(error as Error)?.message ?? String(error)}`);
    }
    if (LocalNotifications) {
      try {
        const { display } = await withTimeout(LocalNotifications.checkPermissions(), 4000);
        parts.push(`permission: ${display}`);
      } catch (error) {
        parts.push(`permission check: ${(error as Error)?.message ?? String(error)}`);
      }
      try {
        const { notifications } = await withTimeout(LocalNotifications.getPending(), 4000);
        parts.push(`scheduled: ${notifications.length}`);
      } catch (error) {
        parts.push(`pending check: ${(error as Error)?.message ?? String(error)}`);
      }
    }
  }
  if (lastError) parts.push(`last error: ${lastError}`);
  return parts.join(" · ");
}
