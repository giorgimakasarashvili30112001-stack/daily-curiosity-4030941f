import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { FactCard } from "@/components/FactCard";
import { DailyQuizCard } from "@/components/DailyQuizCard";
import { TodayLoading } from "@/components/TodayLoading";
import { getTodayView } from "@/lib/today-view";
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
 * Data: today's fact is fetched by the component (`useQuery(todayQuery)`),
 * NOT by a blocking route loader: a loader makes the server wait for the
 * database before sending any HTML, which leaves the phone on a blank screen.
 * Instead the page shell and a loading screen render immediately, and the fact
 * fills in as soon as it is available (instantly when cached for today).
 * Also fetches the signed-in user's profile (for streak) and whether the fact
 * is already saved, both only when a user is logged in. Public route — viewable
 * signed out, but streak/save state and the "keep your streak" CTA only show
 * for authenticated users.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Daily How — one new explainer every day" },
      {
        name: "description",
        content:
          "A fresh how-it-works or what-it-means explainer every day. Build general knowledge in two minutes a morning.",
      },
      { property: "og:title", content: "Daily How — one new explainer every day" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const { data, isError, isFetching, fetchStatus, refetch } = useQuery(todayQuery);

  // The server HTML always contains the loading screen (it has no data), so the
  // first client render must too, otherwise React reports a hydration mismatch
  // when a cached fact is available. Flip right after mount: cached data then
  // appears on the next frame, with no network wait.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const view = getTodayView({
    mounted,
    data,
    isError,
    isFetching,
    fetchStatus,
    todayUtc: new Date().toISOString().slice(0, 10),
  });

  const { user, loading: sessionLoading } = useSession();
  const profileFn = useServerFn(getProfile);
  const savedFn = useServerFn(isFactSaved);

  const streak = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn({}),
    enabled: !!user,
  });

  const saved = useQuery({
    queryKey: ["fact-saved", data?.fact?.id, user?.id],
    queryFn: () => {
      const factId = data?.fact?.id;
      if (!factId) return Promise.resolve({ saved: false });
      return savedFn({ data: { factId } });
    },
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

      {view === "error" ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load today&apos;s explainer. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isFetching ? "Trying…" : "Try again"}
          </button>
        </div>
      ) : view === "loading" ? (
        <TodayLoading />
      ) : view === "fact" && data?.fact ? (
        <FactCard
          key={data.fact.id}
          fact={data.fact}
          dateLabel={dateLabel}
          isSignedIn={!!user}
          initiallySaved={saved.data?.saved ?? false}
        />
      ) : (
        <p className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Today&apos;s explainer is still being prepared. Check back in a moment.
        </p>
      )}

      {/* Wait for the session check so signed-in users never see the sign-in prompt flash. */}
      {sessionLoading ? null : <DailyQuizCard isSignedIn={!!user} />}

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
