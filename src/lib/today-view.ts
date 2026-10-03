/**
 * today-view.ts
 * -------------
 * File-level: Pure decision logic for what the home page shows for today's
 * explainer. Kept free of React so every case can be unit-tested.
 */

/** Which screen the home page should render in place of the explainer card. */
export type TodayView = "loading" | "error" | "fact" | "empty";

/** Inputs describing the state of the "today-fact" query and the client. */
export type TodayViewInput = {
  /** True once the component has mounted on the client (false during SSR/hydration). */
  mounted: boolean;
  /** The query's data, if any: today's date (YYYY-MM-DD, UTC) and the fact or null. */
  data: { date?: string; fact: unknown | null } | undefined;
  /** True when the last fetch attempt failed (after retries). */
  isError: boolean;
  /** True while a request is in flight. */
  isFetching: boolean;
  /** "paused" means the request is waiting for a network connection (offline). */
  fetchStatus: "fetching" | "paused" | "idle";
  /** Today's UTC date, YYYY-MM-DD. */
  todayUtc: string;
};

/**
 * Decides what the home page shows for today's explainer.
 *
 * Rules:
 * - Before mount: always "loading", so the first client render matches the
 *   server HTML (which never has data) and hydration cannot mismatch.
 * - No data and the fetch failed or is waiting for a connection: "error"
 *   (shows a retry message instead of loading forever).
 * - No data yet: "loading".
 * - Data from a previous UTC day while a fresh fetch is running: "loading",
 *   so yesterday's explainer is never presented as today's.
 * - Otherwise "fact" when a fact exists, or "empty" if none is published yet.
 */
export function getTodayView(input: TodayViewInput): TodayView {
  const { mounted, data, isError, isFetching, fetchStatus, todayUtc } = input;
  if (!mounted) return "loading";
  if (!data) return isError || fetchStatus === "paused" ? "error" : "loading";
  const isOutdated = !!data.date && data.date !== todayUtc;
  if (isOutdated && isFetching) return "loading";
  return data.fact ? "fact" : "empty";
}
