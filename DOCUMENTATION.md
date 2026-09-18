# The Daily How — Documentation

One new explainer every day, plus a one-question quiz on yesterday's explainer,
a coin/streak economy, saved explainers, and a native mobile shell with
home-screen widgets and daily reminders.

- **Stack:** TanStack Start v1 (React 19 SSR) + Vite 7 + Tailwind v4, Supabase
  (Postgres, Auth, RLS), TanStack Query with localStorage persistence.
- **Content:** explainers generated with Lovable AI, quiz questions with Gemini.
- **Mobile:** Capacitor shell that loads the hosted site, plus native widgets
  and local notifications.

---

## 1. Product functionality

| Feature | How it works |
| --- | --- |
| Daily explainer | One fact is claimed per UTC date (`facts.pick_date`) so everyone sees the same explainer. Same category two days in a row is avoided. |
| Explainer library | Facts are pre-generated in batches; when fewer than 15 unscheduled facts remain, a new batch is generated automatically. |
| Daily quiz | One multiple-choice question about *yesterday's* explainer. Up to 10 questions per fact (index 0–9), generated on demand and cached in the database. |
| Coins | +1 coin per correct answer (once per day). Missed days cost 30 coins to save. |
| Streak | +1 per day with a correct answer. Longest streak is tracked. A missed day is bought back with coins; if coins run out, the streak resets to 0. |
| Saved explainers | Bookmark any explainer; the list is user-scoped and kept in the local cache. |
| Archive | Up to 120 past explainers with category filters and a countdown to the next day's release. |
| Accounts | Email + password or Google sign-in. Signed-out visitors can read and take the quiz, but nothing is saved. |
| Reminders | Local notifications at 11:00 and 19:00 device time, skipped once the day's question is answered correctly. Native app only. |
| Widget | Home-screen widget showing today's explainer title. |

## 2. UI walkthrough

Every screen uses the same shell: grained dark background, a centred
mobile-width column, a header with the wordmark, and a fixed bottom tab bar
(Today · Archive · Saved · Profile).

- **Today (`/`)** — date label, category chip, title, hook, intro, four
  numbered steps, a "Wait, really?" highlight box, Save and Share buttons, the
  quiz card, a sign-in prompt for guests, and a link to the archive.
- **Archive (`/archive`)** — live countdown to the next explainer, scrollable
  category filter pills, and a list of past explainers (title, category, hook).
- **Explainer permalink (`/fact/:slug`)** — the same card as Today, shareable;
  shows a friendly not-found screen for unknown slugs.
- **Saved (`/saved`)** — bookmarked explainers, newest first.
- **Profile (`/profile`)** — streak icon and count, longest streak, coins,
  questions answered and accuracy, a month calendar of streak days, the
  reminder toggle, editable display name, and sign-out.
- **Sign in (`/auth`)** — Google button, email/password form, toggle between
  sign-in and create-account, plus a "check your inbox" confirmation state.

**Calendar colours:** days with a correct answer are marked as a connected
streak pill; days saved with coins are light blue; today has a ring.

## 3. Code map

```
src/
  routes/            pages (file-based routing) + public API endpoints
  components/        app components; components/ui = shadcn primitives
  hooks/             useSession, useDailyReminders, use-mobile
  lib/
    *.functions.ts   server functions callable from the client (typed RPC)
    *.server.ts      server-only logic (DB, AI, streak maths)
    query-persist.ts localStorage cache for content queries
    cache-time.ts    shared staleTime/gcTime values
    notifications.ts local reminder scheduling
  integrations/supabase/  browser client, admin client, auth middleware
native/              Android + iOS widget sources and setup notes
db/                  incremental SQL applied on top of the migrations
```

### Routes

| Route | File | Notes |
| --- | --- | --- |
| `/` | `routes/index.tsx` | Loader preloads today's fact; streak and save state load client-side when signed in. |
| `/archive` | `routes/archive.tsx` | Loader preloads the archive list. |
| `/fact/$slug` | `routes/fact.$slug.tsx` | Throws not-found for unpublished slugs. |
| `/auth` | `routes/auth.tsx` | Talks to Supabase Auth directly; redirects signed-in users home. |
| `/profile`, `/saved` | `routes/_authenticated/*` | Guarded by `_authenticated/route.tsx`, which redirects to `/auth`. |
| `/api/public/prewarm` | `routes/api/public/prewarm.ts` | Cron endpoint, bearer-secret protected; pre-generates tomorrow's content. |
| `/api/public/today-title` | `routes/api/public/today-title.ts` | Public JSON for the native widgets, cached 5 minutes. |
| root | `routes/__root.tsx` | HTML shell, global meta, error/not-found screens, query provider, auth-change cache invalidation. |

### Server functions

`facts.functions.ts`
- `getTodayFact()` — returns `{ date, fact }`, scheduling and topping up content as needed.
- `getArchive()` — up to 120 published explainers (id, title, category, hook only).
- `getFactBySlug({ slug })` — one published explainer plus its publish date.

`user.functions.ts` (authenticated)
- `getProfile()` — streak, longest streak, coins, saved count; settles the streak as a side effect.
- `updateDisplayName({ displayName })`, `getSavedFacts()`, `isFactSaved({ factId })`, `toggleFavorite({ factId })`.

`quiz.functions.ts`
- `getDailyQuiz()` / `getQuizQuestion({ factId, questionIndex })` — public reads.
- `gradeQuizAnswer(...)` — grades without saving (guests).
- `submitQuizAnswer(...)` — authenticated: records the attempt, awards coin and streak once per day.
- `getQuizAttempt({ factId })`, `getStreakCalendar({ month })`, `getQuizStats()`.

### Server-only helpers

- `facts.server.ts` — fact shape and row mapper, `ensureDailyPick(date)` (idempotent daily claim), `topUpFacts()` (AI batch generation with de-duplication), `countUnusedFacts()`, `todayUtc()`.
- `quiz.server.ts` — `quizFactDate()` (yesterday), question load/generate with duplicate-safe upserts so concurrent requests converge.
- `streak.server.ts` — `settleStreak()`: the streak rules, missed-day buy-back at 30 coins, reset when coins run out; tolerant profile read/write for older schemas.
- `prewarm.server.ts` — idempotent pre-generation of today's and tomorrow's fact and first question.
- `db.server.ts` — service-role Supabase client used by server helpers only.

## 4. Data model (Supabase)

- **facts** — `id, title, slug (unique), category, hook, intro, steps (jsonb), surprising_detail, pick_date (unique), created_at`. Public read.
- **profiles** — `id (= auth user), display_name, streak_count, longest_streak, streak_anchor, saved_days (date[]), coins, last_seen_date, timezone, settled_date`. Row-level security limits each user to their own row; a trigger creates the row on sign-up.
- **favorites** — `(user_id, fact_id)`, own-rows only.
- **quiz_questions** — `fact_id, question_index, prompt, options (jsonb), correct_index, explanation`; unique per `(fact_id, question_index)`. Public read.
- **quiz_attempts** — `user_id, quiz_date, fact_id, question_index, selected_index, is_correct`; unique per `(user_id, quiz_date, question_index)` so a day can be answered once.

Streak days are derived from `quiz_attempts` where `is_correct = true`; bought-back days come from `profiles.saved_days`.

## 5. Caching

Queries carry lifetimes that match the content cadence: today's fact and the
archive stay fresh until the next UTC midnight; individual explainers and quiz
questions never go stale; the saved list is kept current by the save/unsave
action itself; the calendar refreshes hourly.

`lib/query-persist.ts` mirrors only content queries (`today-fact`, `archive`,
`fact`, `saved-facts`) into localStorage for up to 30 days, writing debounced
and flushing when the tab is hidden. Personal stats are never persisted. The
result: repeat visits render instantly and work offline.

## 6. Authentication

Sign-in happens in the browser against Supabase Auth. Every server-function
call gets the user's access token attached automatically (`start.ts` →
`auth-attacher.ts`), and protected functions verify it and run their database
work as that user so row-level security applies (`auth-middleware.ts`). The
`_authenticated` layout redirects signed-out visitors to `/auth`, and the root
route clears personal cached data whenever the session changes.

## 7. Native app, widget, notifications

`capacitor.config.ts` points the native shell at the published site, so app
updates ship without a store release (an internet connection is required).

- **Widget** reads `/api/public/today-title`. Sources live in
  `native/android/` (Kotlin + layout XML) and `native/ios/` (WidgetKit Swift);
  `native/README.md` explains how to copy them into the generated projects.
- **Reminders** use `@capacitor/local-notifications`, scheduled three days
  ahead at 11:00 and 19:00 device time and re-synced after each answer or when
  the app returns to the foreground. The Profile toggle stores the preference
  locally.

## 8. Build and operations

- Web: `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`.
- Server entry (`src/server.ts`) renders a styled error page for unhandled
  failures and applies security headers (CSP, HSTS, frame and MIME protection)
  to every HTML response.
- Content pre-generation: call `/api/public/prewarm` on a schedule with the
  bearer secret.
- Android: `.github/workflows/build-android.yml` builds debug/release APK and a
  Play Store AAB; `native/BUILD_ANDROID.md` and `BUILD_NATIVE.txt` cover the
  local flow (`npm run build` → `npx cap sync android` → Android Studio).

## 9. Known gaps

- `db/add_timezone_streak_job.sql` prepares a per-timezone nightly settlement
  job (`/api/public/settle-streaks`, `job_locks`, `job_cursors`), but that
  endpoint does not exist yet — settlement currently happens on demand in UTC
  whenever the profile or a quiz answer is loaded.
- There is no automated test suite.
