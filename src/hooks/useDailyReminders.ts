/**
 * useDailyReminders
 * ------------------
 * File-level: Hook that manages the native app's daily reminder
 * notifications (scheduled around 11:00 / 19:00), keeping their enabled
 * state in sync with user preference, app visibility changes, and the
 * user's streak progress.
 */
import { useCallback, useEffect, useState } from "react";
import {
  isNativeApp,
  readReminderPref,
  syncDailyReminders,
  writeReminderPref,
  type ReminderStatus,
} from "@/lib/notifications";

/**
 * Keeps the daily 11:00 / 19:00 reminders in sync with the user's streak state,
 * re-running on mount, on app resume and whenever today's progress changes.
 */
export function useDailyReminders(lastCorrectDate?: string | null) {
  // Read the saved choice synchronously so the switch never flashes "off" when the page
  // is opened again. (The pages using this hook are client-only, so this is safe.)
  const [enabled, setEnabled] = useState(() => readReminderPref());
  const [status, setStatus] = useState<ReminderStatus>(() =>
    isNativeApp() ? "ready" : "unsupported",
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEnabled(readReminderPref());
    setStatus(isNativeApp() ? "ready" : "unsupported");
    setReady(true);
  }, []);

  const sync = useCallback(
    async (next: boolean) => {
      const result = await syncDailyReminders({ enabled: next, lastCorrectDate: lastCorrectDate ?? null });
      setStatus(result);
      return result;
    },
    [lastCorrectDate],
  );

  useEffect(() => {
    if (!ready) return;
    void sync(enabled);

    const onVisible = () => {
      if (document.visibilityState === "visible") void sync(enabled);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready, enabled, sync]);

  const toggle = useCallback(
    async (next: boolean) => {
      const result = await sync(next);
      const accepted = next ? result === "ready" : true;
      writeReminderPref(accepted && next);
      setEnabled(accepted && next);
      return result;
    },
    [sync],
  );

  return { enabled, status, toggle, supported: status !== "unsupported" };
}
