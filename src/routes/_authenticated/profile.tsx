import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Coins, PlayCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useDailyReminders } from "@/hooks/useDailyReminders";
import { StreakIcon } from "@/components/StreakIcon";
import { StreakCalendar } from "@/components/StreakCalendar";
import { useServerFn } from "@tanstack/react-start";
import { ShareSheet } from "@/components/ShareSheet";
import { DeleteAccountButton } from "@/components/DeleteAccount";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { getProfile, updateDisplayName } from "@/lib/user.functions";
import { getQuizStats } from "@/lib/quiz.functions";
import { supabase } from "@/integrations/supabase/client";
import { syncWidgetStreak } from "@/lib/widget-bridge";
import { getAdConfig } from "@/lib/ads.functions";
import { adsSupported, playRewardedAd, REWARD_COINS } from "@/lib/rewarded-ad";

/**
 * Route: `/profile` — signed-in user's profile screen (requires auth via
 * the `_authenticated` parent route, which redirects to `/auth` otherwise).
 * Shows streak, longest streak, coins, quiz stats, a streak calendar,
 * daily reminder toggle, an editable display name, and sign out.
 * Data: fetches `getProfile` and `getQuizStats` server functions via
 * `useServerFn`/React Query (auth-bound; the Supabase bearer token is
 * attached automatically by the auth-attacher middleware).
 */
export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Daily How" },
      { name: "description", content: "Track your reading streak and manage your account." },
      { property: "og:title", content: "Your profile — Daily How" },
      { property: "og:description", content: "Your streak, your name, your account." },
    ],
  }),
  component: ProfilePage,
});

/** Profile page component: streak/coin stats, name editing, sign-out, reminders. */
function ProfilePage() {
  const fetchProfile = useServerFn(getProfile);
  const fetchQuizStats = useServerFn(getQuizStats);
  const saveName = useServerFn(updateDisplayName);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile({}) });
  const quizStats = useQuery({ queryKey: ["quiz-stats"], queryFn: () => fetchQuizStats({}) });

  useEffect(() => {
    if (data?.displayName) setName(data.displayName);
  }, [data?.displayName]);

  const onSave = async () => {
    setBusy(true);
    try {
      await saveName({ data: { displayName: name.trim() } });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Name updated");
    } catch {
      toast.error("Could not save your name");
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    void syncWidgetStreak(null);
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <AppShell>
      <AppHeader eyebrow="Profile" />

      <div className="rounded-3xl border border-border bg-card p-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Current streak
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <StreakIcon streak={data?.streak} className="h-10 w-10" />
          <p className="text-display text-5xl text-primary">{data?.streak ?? 0}</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.streak === 1 ? "correct day in a row" : "correct days in a row"}
        </p>
        <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
          Longest streak: <span className="text-foreground">{data?.longestStreak ?? 0}</span>
        </p>
        <div className="mt-4 flex justify-center">
          <ShareSheet
            title="Share my streak"
            text={`I'm on a ${data?.streak ?? 0}-day streak on Daily How — one new explainer every day.`}
            url={typeof window !== "undefined" ? window.location.origin : "https://thedailyhow.app"}
          />
        </div>
      </div>

      <CoinsCard coins={quizStats.data?.coins ?? 0} />

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-border bg-card p-5 text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Questions answered
          </p>
          <p className="mt-2 text-display text-3xl text-foreground">
            {quizStats.data?.answered ?? 0}
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Correct rate
          </p>
          <p className="mt-2 text-display text-3xl text-primary">
            {quizStats.data && quizStats.data.answered > 0
              ? `${Math.round((quizStats.data.correct / quizStats.data.answered) * 100)}%`
              : "—"}
          </p>
        </div>
      </div>

      <StreakCalendar />

      <ReminderSettings lastCorrectDate={data?.lastSeenDate ?? null} />

      <div className="mt-5 rounded-3xl border border-border bg-card p-6">
        <label htmlFor="displayName" className="text-xs text-muted-foreground">
          Display name
        </label>
        <input
          id="displayName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={busy || !name.trim()}
          className="mt-3 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Save
        </button>
      </div>

      <button
        type="button"
        onClick={() => void onSignOut()}
        className="mt-5 w-full rounded-full border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
      >
        Sign out
      </button>
      <div className="mt-3">
        <DeleteAccountButton />
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link to="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
      </p>
    </AppShell>
  );
}

/** Toggle for enabling/disabling scheduled local daily reminder notifications. */
function ReminderSettings({ lastCorrectDate }: { lastCorrectDate: string | null }) {
  const { enabled, status, toggle } = useDailyReminders(lastCorrectDate);
  const [busy, setBusy] = useState(false);
  // Show the new position immediately; it slides back if the change is refused.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const onToggle = async () => {
    if (busy) return;
    setBusy(true);
    setOptimistic(!enabled);
    try {
      const result = await toggle(!enabled);
      if (result === "denied") toast.error("Notifications are blocked in your system settings");
      else if (result === "unsupported")
        toast.info("Reminders work in the installed app, not the browser");
      else toast.success(!enabled ? "Reminders on" : "Reminders off");
    } catch (error) {
      toast.error(`Could not change reminders: ${(error as Error)?.message ?? "unknown error"}`);
    } finally {
      setOptimistic(null);
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-3xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bell className="h-4 w-4" aria-hidden="true" />
            Daily reminders
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            A nudge at 11:00 and 19:00 — skipped once you&apos;ve answered today.
          </p>
        </div>
        <Switch
          checked={optimistic ?? enabled}
          disabled={status === "unsupported"}
          onCheckedChange={() => void onToggle()}
          aria-label="Daily reminders"
        />
      </div>
      {status === "unsupported" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Available in the installed app on your phone.
        </p>
      )}
      {status === "denied" && (
        <p className="mt-3 text-xs text-destructive">
          Notifications are blocked — enable them for Daily How in your system settings.
        </p>
      )}
    </div>
  );
}

/** Set to true to show the "More coins" (watch an ad) button on the Profile page again. */
const SHOW_MORE_COINS = false;

/**
 * Coins card with a "More coins" button that plays a rewarded video in the Android app. The +3 coins are credited by the server once
 * Google confirms the ad was watched, so we wait for the balance to change.
 */
function CoinsCard({ coins }: { coins: number }) {
  const [busy, setBusy] = useState(false);
  const fetchAdConfig = useServerFn(getAdConfig);
  const fetchQuizStats = useServerFn(getQuizStats);
  const queryClient = useQueryClient();
  const native = adsSupported();

  const watch = async () => {
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) {
        toast.error("Please sign in again");
        return;
      }
      const cfg = await fetchAdConfig({});
      const result = await playRewardedAd(userId, cfg.adUnitId, cfg.isTesting);
      if (result === "unavailable") {
        toast.error("No ad is available right now. Try again in a bit.");
        return;
      }
      if (result === "closed") {
        toast("Watch the whole ad to earn coins");
        return;
      }
      // Rewarded: Google confirms to our server, which credits the coins. Wait for it.
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const stats = await fetchQuizStats({});
        if ((stats?.coins ?? 0) > coins) {
          queryClient.setQueryData(["quiz-stats"], stats);
          void queryClient.invalidateQueries({ queryKey: ["profile"] });
          toast.success(`+${REWARD_COINS} coins`);
          return;
        }
      }
      toast("Your coins will appear shortly. If not, you may have reached today's limit.");
      void queryClient.invalidateQueries({ queryKey: ["quiz-stats"] });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-3xl border border-border bg-card p-6 text-center">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Coins</p>
      <p className="mt-2 flex items-center justify-center gap-2 text-display text-4xl text-primary">
        <Coins className="h-7 w-7" aria-hidden="true" />
        {coins}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">1 coin per correct answer</p>
      {!SHOW_MORE_COINS ? null : native ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void watch()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <PlayCircle className="h-5 w-5" aria-hidden="true" />
          {busy ? "Please wait…" : `More coins · watch an ad (+${REWARD_COINS})`}
        </button>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Watch an ad for +{REWARD_COINS} coins in the Android app.
        </p>
      )}
    </div>
  );
}
