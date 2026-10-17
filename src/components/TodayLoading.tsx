/**
 * TodayLoading
 * ------------
 * File-level: Loading screen for the home page, shown while today's explainer
 * is being fetched. It mirrors the layout of `FactCard` (category pill, title,
 * hook, intro, numbered steps) so the page does not jump when the real content
 * arrives, and it renders instantly from the server because it needs no data.
 */
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * TodayLoading
 * Skeleton placeholder for the daily explainer card plus an accessible
 * "Loading today's explainer…" status line.
 *
 * No props or state; pure presentation.
 */
export function TodayLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <article className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-6 pt-6 pb-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="mt-5 h-7 w-11/12" />
          <Skeleton className="mt-2 h-7 w-3/5" />
          <Skeleton className="mt-4 h-4 w-4/5" />
        </div>

        <div className="px-6 py-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-11/12" />

          <div className="mt-6 space-y-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="mt-2 h-3.5 w-full" />
                  <Skeleton className="mt-1.5 h-3.5 w-5/6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Loading today&apos;s explainer…
      </p>
    </div>
  );
}
