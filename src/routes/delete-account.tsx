import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DeleteAccountButton } from "@/components/DeleteAccount";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_EMAIL } from "@/lib/legal";

/** Route: `/delete-account` — public web page where anyone can request account deletion (Google Play). */
export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete your account — Daily How" },
      {
        name: "description",
        content: "How to permanently delete your Daily How account and the data linked to it.",
      },
    ],
  }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <AppShell>
      <div className="py-6">
        <Link to="/" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          ← Back to Daily How
        </Link>
        <h1 className="mt-3 text-display text-2xl text-foreground">Delete your account</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You can delete your Daily How account and its data at any time, in the app (Profile →
          Delete my account) or here.
        </p>
        <p className="mt-3 text-sm font-semibold text-foreground">What is deleted</p>
        <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Your account (email or Google sign-in) and display name</li>
          <li>Your streak, coins and quiz answers and results</li>
          <li>Your saved explainers and ad-reward records</li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Deletion is immediate and permanent. Nothing is kept, except records our hosting providers
          hold briefly in routine backups and security logs.
        </p>

        <div className="mt-6 rounded-3xl border border-border bg-card p-5">
          {signedIn === null ? (
            <p className="text-sm text-muted-foreground">Checking your session…</p>
          ) : signedIn ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">You are signed in.</p>
              <DeleteAccountButton />
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Sign in to the account you want to delete, then come back to this page.
              </p>
              <Link
                to="/auth"
                className="mt-3 block w-full rounded-full bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
              >
                Sign in
              </Link>
            </>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Can't sign in? Email{" "}
          <a
            className="underline"
            href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20Daily%20How%20account`}
          >
            {CONTACT_EMAIL}
          </a>{" "}
          from the address you signed up with and we'll delete it within 30 days.
        </p>
      </div>
    </AppShell>
  );
}
