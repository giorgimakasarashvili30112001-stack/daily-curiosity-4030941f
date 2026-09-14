/**
 * Small time-related helpers used to schedule client-side refreshes and
 * offline cache lifetimes around the app's daily UTC content cycle.
 */

/**
 * Computes how long (in ms) until the next UTC midnight, which is when a
 * new daily fact becomes available.
 *
 * How it works: builds a `Date` for the start (00:00:00.000 UTC) of
 * tomorrow relative to `now`, then returns the difference, floored at
 * 1 second so callers never schedule a near-immediate/zero-delay timer.
 *
 * Params: none.
 * Returns: milliseconds until next UTC midnight (minimum 1000).
 * Side effects: none.
 */
export function msUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(1000, next - now.getTime());
}

/** Keep offline content around for a month. */
export const FACT_GC_TIME = 1000 * 60 * 60 * 24 * 30;
