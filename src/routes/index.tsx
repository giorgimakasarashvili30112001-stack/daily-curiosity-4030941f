import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { FactCard } from "@/components/FactCard";
import { DailyQuizCard } from "@/components/DailyQuizCard";
import { getTodayFact } from "@/lib/facts.functions";
import { getProfile, isFactSaved } from "@/lib/user.functions";
import { useSession } from "@/hooks/useSession";
import { FACT_GC_TIME, msUntilUtcMidnight } from "@/lib/cache-time";

/**
 * Query definition for today's featured fact. Cached until the next UTC
 * midnight (when a new fact is published), matching the daily content cadence.
 */
const todayQuery = queryOptions({
  queryKey: ["today-fact"],
  queryFn: () => getTodayFact(),
  staleTime: msUntilUtcMidnight(),
  gcTime: FACT_GC_TIME,
});


/**
 * Route: `/` — the app's home page / "Today" screen.
 * Shows today's explainer (fact) plus the daily quiz card.
 * Data: loads `todayQuery` (today's fact) via the loader so it's ready
 * before render; additionally fetches the signed-in user's profile (for
 * streak) and whether the fact is already saved, both only when a user is
 * logged in. Public route — viewable signed out, but streak/save state and
 * the "keep your streak" CTA only show for authenticated users.
 */
export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(todayQuery),
  head: () => ({
    meta: [
      { title: "The Daily How — one new explainer every day" },
      {
        name: "description",
        content:
          "A fresh how-it-works or what-it-means explainer every day. Build general knowledge in two minutes a morning.",
      },
      { property: "og:title", content: "The Daily How — one new explainer every day" },
      {
        property: "og:description",
        content: "How things work, what things mean. One short explainer, every single day.",
      },
    ],
  }),
  component: TodayPage,
});

/** Home page component: renders today's fact, quiz, sign-in CTA, and archive link. */
function TodayPage() {
  const { data } = useQuery(todayQuery);
  const { user } = useSession();
  const profileFn = useServerFn(getProfile);
  const savedFn = useServerFn(isFactSaved);

  const streak = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn({}),
    enabled: !!user,
  });

  const saved = useQuery({
    queryKey: ["fact-saved", data?.fact?.id, user?.id],
    queryFn: () => savedFn({ data: { factId: data!.fact!.id } }),
    enabled: !!user && !!data?.fact,
  });

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const dateLabel = useMemo(() => {
    if (!data?.date) return "";
    return new Date(`${data.date}T00:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }, [data?.date]);

  return (
    <AppShell>
      <AppHeader eyebrow="Today's explainer" streak={streak.data?.streak ?? null} />

      {data?.fact ? (
        <FactCard
          key={data.fact.id}
          fact={data.fact}
          dateLabel={dateLabel}
          isSignedIn={!!user}
          initiallySaved={saved.data?.saved ?? false}
        />
      ) : (
        <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Today's explainer is still being prepared. Check back in a moment.
        </p>
      )}

      <DailyQuizCard isSignedIn={!!user} />

      {!user ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Sign in to keep your streak and save explainers across devices.
          </p>
          <Link
            to="/auth"
            className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      ) : null}

      <Link
        to="/archive"
        className="mt-6 block text-center text-xs uppercase tracking-[0.16em] text-muted-foreground underline-offset-4 hover:underline"
      >
        Browse past days
      </Link>
    </AppShell>
  );
}
