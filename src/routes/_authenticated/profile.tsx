import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Coins } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useDailyReminders } from "@/hooks/useDailyReminders";
import { StreakIcon } from "@/components/StreakIcon";
import { StreakCalendar } from "@/components/StreakCalendar";
import { useServerFn } from "@tanstack/react-start";
import { ShareSheet } from "@/components/ShareSheet";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { getProfile, updateDisplayName } from "@/lib/user.functions";
import { getQuizStats } from "@/lib/quiz.functions";
import { supabase } from "@/integrations/supabase/client";

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
      { title: "Your profile — The Daily How" },
      { name: "description", content: "Track your reading streak and manage your account." },
      { property: "og:title", content: "Your profile — The Daily How" },
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
            text={`I'm on a ${data?.streak ?? 0}-day streak on The Daily How — one new explainer every day.`}
            url={typeof window !== "undefined" ? window.location.origin : "https://thedailyhow.app"}
          />
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Coins</p>
        <p className="mt-2 flex items-center justify-center gap-2 text-display text-4xl text-primary">
          <Coins className="h-7 w-7" aria-hidden="true" />
          {quizStats.data?.coins ?? 0}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">1 coin per correct answer</p>

      </div>


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
    </AppShell>
  );
}

/** Toggle for enabling/disabling scheduled local daily reminder notifications. */
function ReminderSettings({ lastCorrectDate }: { lastCorrectDate: string | null }) {
  const { enabled, status, toggle } = useDailyReminders(lastCorrectDate);
  const [busy, setBusy] = useState(false);

  const onToggle = async () => {
    setBusy(true);
    try {
      const result = await toggle(!enabled);
      if (result === "denied") toast.error("Notifications are blocked in your system settings");
      else if (result === "unsupported")
        toast.info("Reminders work in the installed app, not the browser");
      else toast.success(!enabled ? "Reminders on" : "Reminders off");
    } finally {
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
          checked={enabled}
          disabled={busy || status === "unsupported"}
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
          Notifications are blocked — enable them for The Daily How in your system settings.
        </p>
      )}
    </div>
  );
}
