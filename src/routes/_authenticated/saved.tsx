import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { getSavedFacts } from "@/lib/user.functions";
import { useSession } from "@/hooks/useSession";
import { FACT_GC_TIME } from "@/lib/cache-time";

/**
 * Route: `/saved` — signed-in user's library of bookmarked explainers
 * (requires auth via the `_authenticated` parent route).
 * Shows a list of saved facts linking to their `/fact/$slug` pages.
 * Data: fetches `getSavedFacts` server function via `useServerFn`/React
 * Query, keyed by user id. Kept fresh locally by the save/unsave mutation
 * elsewhere in the app, so it's cached with `staleTime: Infinity` and never
 * refetched on revisit.
 */
export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({
    meta: [
      { title: "Saved explainers — The Daily How" },
      { name: "description", content: "Every explainer you bookmarked, in one place." },
      { property: "og:title", content: "Saved explainers — The Daily How" },
      { property: "og:description", content: "Your personal library of saved explainers." },
    ],
  }),
  component: SavedPage,
});

/** Saved page component: lists the current user's bookmarked facts. */
function SavedPage() {
  const fetchSaved = useServerFn(getSavedFacts);
  const { user } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["saved-facts", user?.id],
    queryFn: () => fetchSaved({}),
    enabled: !!user,
    // Cache-first: the list is kept up to date locally by the save/unsave
    // mutation, so a cached list is never refetched on revisit.
    staleTime: Infinity,
    gcTime: FACT_GC_TIME,
  });

  return (
    <AppShell>
      <AppHeader eyebrow="Saved" />

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading your library…</p>
      ) : data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing saved yet. Tap Save on an explainer to keep it here.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((fact) => (
            <li key={fact.slug}>
              <Link
                to="/fact/$slug"
                params={{ slug: fact.slug }}
                className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {fact.category}
                </span>
                <h2 className="mt-2 text-display text-lg leading-snug text-foreground">
                  {fact.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{fact.hook}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
