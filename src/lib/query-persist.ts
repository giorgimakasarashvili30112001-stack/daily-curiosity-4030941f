/**
 * Persists a whitelisted subset of the TanStack Query cache (public fact
 * content plus the user's saved-facts list) to `localStorage`, so
 * previously viewed content is available instantly and offline on
 * repeat visits, without persisting sensitive/user-specific or
 * in-flight data.
 */
import { hydrate, dehydrate, type QueryClient, type Query } from "@tanstack/react-query";

const STORAGE_KEY = "the-daily-how-facts-cache-v1";
const MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days

const CACHEABLE_KEYS = new Set(["archive", "fact", "today-fact", "saved-facts"]);

/**
 * Decides whether a given query is safe/useful to persist to
 * localStorage.
 *
 * Fact content plus the user's own saved list (keyed per user id).
 *
 * Params: `query` — a TanStack Query `Query` instance from the cache.
 * Returns: `true` only for whitelisted query keys that have successfully
 * resolved with data.
 * Side effects: none.
 */
function isCacheable(query: Query): boolean {
  const key = query.queryKey[0];
  if (typeof key !== "string" || !CACHEABLE_KEYS.has(key)) return false;
  // Persisting a pending query would restore an unresolvable promise and the
  // query would hang forever on the next visit.
  return query.state.status === "success" && query.state.data !== undefined;
}

type DehydratedQuery = { state?: { status?: string; data?: unknown } };
type Stored = { timestamp: number; state: { queries?: DehydratedQuery[] } };

/**
 * Drops anything that isn't settled data (legacy caches may hold pending
 * queries).
 *
 * Params: `state` — the dehydrated query-cache state read from storage.
 * Returns: the same state shape with only successful, data-bearing
 * queries kept.
 * Side effects: none.
 */
function sanitize(state: Stored["state"]) {
  return {
    ...state,
    queries: (state.queries ?? []).filter(
      (q) => q.state?.status === "success" && q.state?.data !== undefined,
    ),
  };
}

/**
 * Restores cached fact content from localStorage synchronously (so route
 * loaders can read it before any network call) and keeps it in sync
 * going forward.
 *
 * How it works:
 * - On call, synchronously reads `STORAGE_KEY` from localStorage; if
 *   found and not older than `MAX_AGE`, hydrates the given `queryClient`
 *   with the sanitized cached state; otherwise clears the stale entry.
 * - Defines a `save()` function that dehydrates only cacheable queries
 *   (via `isCacheable`) and writes them back to localStorage.
 * - Debounces `save()` by 800ms on every query-cache change to avoid
 *   excessive writes.
 * - Also flushes `save()` once shortly after startup (SSR-hydrated data
 *   never triggers the cache subscription), on window `load`, on
 *   `pagehide`, and when the page becomes hidden — to make sure the
 *   latest data is persisted even without further cache activity.
 *
 * Params: `queryClient` — the app's TanStack Query client.
 * Returns: void.
 * Side effects: reads/writes `localStorage`; registers event listeners
 * and a query-cache subscription that live for the lifetime of the
 * page. No-op on the server (`typeof window === "undefined"`).
 */
export function setupFactCache(queryClient: QueryClient) {
  if (typeof window === "undefined") return;


  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (Date.now() - parsed.timestamp < MAX_AGE) {
        hydrate(queryClient, sanitize(parsed.state));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    // Corrupt cache: ignore and start fresh.
  }

  const save = () => {
    try {
      const state = dehydrate(queryClient, { shouldDehydrateQuery: isCacheable });
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ timestamp: Date.now(), state } satisfies Stored),
      );
    } catch {
      // Storage full or unavailable — caching is best-effort.
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  queryClient.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 800); // Increased from 300ms to reduce localStorage writes
  });

  // SSR-hydrated data never triggers the cache subscription, so flush once
  // after startup and again when the page is backgrounded or closed.
  setTimeout(save, 1500);
  window.addEventListener("load", () => setTimeout(save, 0));
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
}
