/**
 * FactCard
 * --------
 * File-level: Renders the full detail view of a single "daily fact"
 * explainer — title, hook, intro, numbered steps, a "surprising detail"
 * callout, and Save/Share actions.
 */
import { useEffect, useState, memo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { toggleFavorite, type SavedFact } from "@/lib/user.functions";
import { ShareSheet } from "@/components/ShareSheet";
import type { Fact } from "@/lib/facts.functions";

// Props accepted by FactCard.
interface FactCardProps {
  fact: Fact;
  dateLabel?: string | undefined;
  isSignedIn: boolean;
  initiallySaved?: boolean;
}

/**
 * FactCard
 * Displays a fact's category, title, hook, intro paragraph, numbered
 * explanation steps, a highlighted "Wait, really?" surprising-detail box,
 * and Save/Share buttons plus a permanent link to the fact's page.
 *
 * Props:
 * - fact: the Fact data to render (title, hook, steps, etc).
 * - dateLabel: optional label (e.g. formatted date) shown next to the category.
 * - isSignedIn: whether the current user is authenticated (gates saving).
 * - initiallySaved: whether the fact is already saved, used to seed local state.
 *
 * State:
 * - saved: local optimistic "is this fact saved" flag, kept in sync with
 *   `initiallySaved` via an effect (e.g. once a saved-state query resolves).
 *
 * Data fetching / mutations:
 * - Uses a React Query `useMutation` wrapping the `toggleFavorite` server
 *   function to save/unsave the fact, updating the `["saved-facts"]` query
 *   cache directly on success so the Saved tab reflects the change instantly.
 *
 * User interactions:
 * - Clicking Save toggles the favorite (or redirects to /auth if signed out).
 * - Renders a ShareSheet button for sharing the fact.
 * - "Open permanent link" navigates to the fact's dedicated URL.
 *
 * Wrapped in React.memo with a custom comparator so it only re-renders when
 * fact id, isSignedIn, initiallySaved, or dateLabel actually change.
 */
export const FactCard = memo(function FactCard({
  fact,
  dateLabel,
  isSignedIn,
  initiallySaved = false,
}: FactCardProps) {
  // Optimistic local "saved" flag; re-synced from props once the caller's
  // saved-state query resolves (see effect below).
  const [saved, setSaved] = useState(initiallySaved);

  // Keep in sync once the saved-state query resolves after mount.
  useEffect(() => {
    setSaved(initiallySaved);
  }, [initiallySaved, fact.id]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toggle = useServerFn(toggleFavorite);

  const mutation = useMutation({
    mutationFn: () => toggle({ data: { factId: fact.id } }),
    onSuccess: (result) => {
      setSaved(result.saved);
      // Keep the cached (and persisted) saved list in sync so the Saved tab can
      // render straight from cache without hitting the database again.
      queryClient.setQueriesData<SavedFact[]>({ queryKey: ["saved-facts"] }, (prev) => {
        const list = prev ?? [];
        if (!result.saved) return list.filter((row) => row.slug !== fact.slug);
        if (list.some((row) => row.slug === fact.slug)) return list;
        return [
          {
            slug: fact.slug,
            title: fact.title,
            category: fact.category,
            hook: fact.hook,
            savedAt: new Date().toISOString(),
          },
          ...list,
        ];
      });
      toast.success(result.saved ? "Saved to your list" : "Removed from your list");
    },
    onError: () => toast.error("Could not update your saved list"),
  });

  // Handles the Save button click: requires sign-in, otherwise toggles the favorite.
  const onSave = () => {
    if (!isSignedIn) {
      toast("Sign in to save explainers");
      void navigate({ to: "/auth" });
      return;
    }
    mutation.mutate();
  };




  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
            {fact.category}
          </span>
          {dateLabel ? <span>{dateLabel}</span> : null}
        </div>
        <h1 className="mt-4 text-display text-[28px] leading-[1.15] text-foreground">
          {fact.title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-primary">{fact.hook}</p>
      </div>

      <div className="px-6 py-6">
        <p className="text-[15px] leading-relaxed text-muted-foreground">{fact.intro}</p>

        <ol className="mt-6 space-y-5">
          {fact.steps.map((step, index) => (
            <li key={`${fact.id}-${index}`} className="flex gap-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">{step.heading}</h2>
                <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-7 rounded-2xl border border-primary/25 bg-primary/10 p-5">
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-primary">Wait, really?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground">
            {fact.surprising_detail}
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={mutation.isPending}
            aria-pressed={saved}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
              saved
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            {saved ? (
              <BookmarkCheck className="h-4 w-4 fill-primary text-primary" aria-hidden="true" />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            )}
            {saved ? "Saved" : "Save"}
          </button>
          <ShareSheet
            title={fact.title}
            text={fact.hook}
            url={typeof window !== "undefined" ? `${window.location.origin}/fact/${fact.slug}` : `/fact/${fact.slug}`}
          />

        </div>

        <Link
          to="/fact/$slug"
          params={{ slug: fact.slug }}
          className="mt-4 block text-center text-xs uppercase tracking-[0.16em] text-muted-foreground underline-offset-4 hover:underline"
        >
          Open permanent link
        </Link>
      </div>
    </article>
  );
}, (prev, next) => {
  // Custom comparison: only rerender if these props actually change
  return (
    prev.fact.id === next.fact.id &&
    prev.isSignedIn === next.isSignedIn &&
    prev.initiallySaved === next.initiallySaved &&
    prev.dateLabel === next.dateLabel
  );
});
