import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CONTACT_EMAIL, POLICY_UPDATED } from "@/lib/legal";

/** Route: `/privacy` — public privacy policy (required by Google Play). No auth, no data loading. */
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Daily How" },
      {
        name: "description",
        content: "What Daily How collects, why, who processes it, and how to delete your data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 text-display text-lg text-foreground">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return <li className="mt-1">{children}</li>;
}

function PrivacyPage() {
  return (
    <AppShell>
      <div className="py-6">
        <Link to="/" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          ← Back to Daily How
        </Link>
        <h1 className="mt-3 text-display text-2xl text-foreground">Privacy Policy</h1>
        <p className="mt-1 text-xs text-muted-foreground">Last updated {POLICY_UPDATED}</p>

        <P>
          Daily How ("the app", "we") shows one short explainer a day and a quiz on yesterday's
          explainer. This page describes what information the website and the Android app handle.
          You can use the app without an account; an account is only needed for the quiz, streaks,
          coins and saved explainers.
        </P>

        <H>Information we collect</H>
        <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed text-muted-foreground">
          <Li>
            <b>Account details</b> — your email address and a password (stored only as a hash by our
            authentication provider), or, if you choose "Continue with Google", your Google account
            email and name. We never see your Google password.
          </Li>
          <Li>
            <b>Your activity</b> — your display name, streak, longest streak, last visit date,
            coins, quiz answers and results, and the explainers you save.
          </Li>
          <Li>
            <b>On your device</b> — a cache of explainers and your settings (for example whether
            reminders are on) kept in local storage so the app opens quickly. This stays on your
            device and you can clear it from your browser or Android settings.
          </Li>
          <Li>
            <b>Technical logs</b> — our hosting and database providers may process your IP address
            and basic request data to deliver the service and prevent abuse.
          </Li>
          <Li>
            <b>Ad data</b> — collected directly by the advertising provider on your device, not by
            us (see "Advertising").
          </Li>
        </ul>
        <P>
          We do not collect your precise location, contacts, photos or microphone. We do not sell
          your personal data, and we do not use it for advertising or share it with advertisers.
        </P>

        <H>Advertising</H>
        <P>
          Daily How offers optional rewarded video ads: you can choose to watch one to earn coins,
          and no ads appear otherwise. Ads are provided by Google AdMob, a third-party advertising
          service, which may collect certain information from your device itself, such as your IP
          address, device and app identifiers (for example the Android advertising ID) and ad
          interactions, in order to serve and measure ads and prevent fraud. We do not give the ad
          service your email, name, streak, quiz results or any other account data. Google acts
          under its own privacy policy. On Android you can reset your advertising ID or opt out of
          ad personalization in Settings → Google → Ads, and in some regions the app will ask for
          your consent before showing personalized ads.
        </P>

        <H>How we use it</H>
        <P>
          To sign you in, keep your streak, coins and saved explainers in sync across devices, grade
          quizzes, send the optional reminders you turn on, show ads that help keep the app free,
          and keep the service secure and working. We never use your account data for advertising.
        </P>

        <H>Reminders (Android)</H>
        <P>
          If you turn reminders on, the app asks for notification permission and schedules local
          notifications on your device. They are created on the device itself; no notification token
          or push service is used. You can turn them off in the app or in Android settings.
        </P>

        <H>Who processes data for us</H>
        <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed text-muted-foreground">
          <Li>Supabase — authentication and database.</Li>
          <Li>Cloudflare — website hosting and delivery.</Li>
          <Li>Google — optional Google sign-in. Google's own privacy policy applies to it.</Li>
          <Li>Google AdMob — shows ads, as described under "Advertising" above.</Li>
          <Li>
            Google Gemini API — used to write the explainers and quizzes. No personal data about you
            is sent to it.
          </Li>
        </ul>
        <P>
          These providers process data only to provide their service to us. Data may be processed in
          countries other than your own.
        </P>

        <H>Retention and deletion</H>
        <P>
          We keep your account data until you delete it. You can delete your account and all data
          linked to it (profile, streak, coins, quiz results, saved explainers) yourself, at any
          time, in the app under Profile → Delete my account, or on the web at{" "}
          <Link to="/delete-account" className="underline">
            /delete-account
          </Link>
          . Deletion is immediate. If you can't sign in, email{" "}
          <a
            className="underline"
            href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20Daily%20How%20account`}
          >
            {CONTACT_EMAIL}
          </a>{" "}
          from the address you signed up with and we delete it within 30 days. Data on your device
          is removed by clearing the app's storage or uninstalling the app.
        </P>

        <H>Your rights</H>
        <P>
          Depending on where you live, you may have the right to access, correct, export or delete
          your data, and to object to or restrict how it is used. Contact us at the address below
          and we will respond.
        </P>

        <H>Children</H>
        <P>
          Daily How is not directed to children under 13 (or the minimum age in your country), and
          we do not knowingly collect their data. If you believe a child has created an account,
          contact us and we will delete it.
        </P>

        <H>Security</H>
        <P>
          Data is sent over HTTPS, and database access rules limit each signed-in user to their own
          records. No system is perfectly secure, but we take reasonable steps to protect it.
        </P>

        <H>Changes</H>
        <P>
          If we change this policy we will update the date above. Significant changes will be
          announced in the app.
        </P>

        <H>Contact</H>
        <P>
          Questions or requests:{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </P>
      </div>
    </AppShell>
  );
}
