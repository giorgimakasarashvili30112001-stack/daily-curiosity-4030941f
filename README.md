# Daily How

One new explainer every day, plus a one-question quiz on yesterday's explainer,
a coin/streak system, saved explainers, and an optional native Android/iOS shell
with a home-screen widget and daily reminders.

Full feature and architecture notes live in [DOCUMENTATION.md](DOCUMENTATION.md).

**Stack:** TanStack Start (React 19 SSR) · Vite · Tailwind v4 · Supabase
(Postgres, Auth, RLS) · Google Gemini · Nitro · Capacitor.

## Requirements

- Node.js 22+ and npm
- A [Supabase](https://supabase.com) project
- A [Gemini API key](https://aistudio.google.com/apikey)

## Configuration: one file

Everything is configured in a single, gitignored **`.env`** file. Copy the
template and fill it in:

```sh
cp .env.example .env
```

| Variable | Used by |
| --- | --- |
| `APP_URL` | Native widgets, Capacitor shell, daily scheduler SQL |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server and browser (public values) |
| `SUPABASE_SERVICE_ROLE_KEY` 🔒 | Server only (bypasses RLS) |
| `GEMINI_API_KEY` 🔒 | Explainer + quiz generation |
| `PREWARM_SECRET` 🔒 | Auth for `/api/public/prewarm` |
| `NITRO_PRESET` | Build target (default `node-server`) |

Files that can't read `.env` at runtime (Android/iOS widgets, scheduler SQL,
`supabase/config.toml`) are **generated from it**:

```sh
npm run config:sync
```

Real environment variables set on your host override `.env`, so on a hosting
platform you can set the same names in its dashboard instead of uploading the
file.

## Setup

1. `npm install`
2. Create and fill `.env` (see above), then `npm run config:sync`.
3. **Create the database.** In the Supabase SQL editor, run the files in
   `supabase/migrations/`, then `ANON_CONTENT_POLICIES.sql` and anything in
   `db/`.
4. **Enable auth providers** in Supabase (Email, and Google if wanted). Under
   *Authentication → URL Configuration* set the Site URL and redirect URLs to
   your `APP_URL` (and `http://localhost:8080` for development).
5. `npm run dev` → http://localhost:8080

## Build & deploy

```sh
npm run build
npm start          # node --env-file-if-exists=.env .output/server/index.mjs
```

The server injects `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` into each page
at request time, so changing them needs only a restart, not a rebuild. Set `NITRO_PRESET` in `.env`
(e.g. `vercel`, `netlify`, `cloudflare-module`) to target another host.

### Cloudflare (Workers / Pages)

1. Connect the repo; build command `npm run build`. Nitro detects Cloudflare
   automatically. If your output isn't a Worker, add `NITRO_PRESET=cloudflare-module`
   (Workers) or `cloudflare-pages` (Pages) as a **build** variable.
2. In the project's **Settings → Variables and secrets** (the *runtime* ones,
   not "Build variables"), add:
   - plain variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
   - **secrets**: `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `PREWARM_SECRET`
   The build sets `keep_vars: true` in the generated Worker config, so plain
   variables added in the dashboard are **kept** on every deploy. (Without it,
   each `wrangler deploy` from a git push wipes dashboard variables; secrets were
   never affected.) Keep the Worker's name unchanged: variables belong to the
   Worker, so a renamed Worker starts with none.
3. Redeploy. The server hands the two public Supabase values to the browser in
   the page itself, so no rebuild is needed when they change. Secrets are never
   sent to the browser.

## Daily scheduler

A new explainer is chosen **every day, whether or not anyone opens the app.** This is
done by two separate pieces; run both once in the Supabase SQL editor:

1. **`db/daily_picks.sql` (required, no setup needed).** Creates database functions
   and an hourly pg_cron job (`daily-pick`) that picks each day's explainer inside
   the database, so it never depends on the website, Cloudflare or the AI. It also
   **fills any missed days** (and does so immediately when you run it), and retries
   within the hour if anything fails. If the library of unused explainers ever runs
   out, the least recently featured one is re-featured as a copy rather than leaving
   the day blank.
2. **`db/generated/daily_scheduler.sql`.** Run `npm run config:sync` first (it uses your
   `APP_URL`). It creates a pg_cron job (00:05 UTC) that calls `/api/public/prewarm`
   to top up the library with AI-written explainers and pre-generate quizzes.
   (Don't run the `.tpl` template directly.)

Check it is working: `select pick_date, title from facts where pick_date is not null
order by pick_date desc limit 10;` (no gaps), `select * from cron.job_run_details
order by start_time desc limit 10;`, and `select count(*) from facts where pick_date
is null;` (unused explainers left; if this nears 0, check the prewarm job and
`GEMINI_API_KEY`).

## Native app

See [native/README.md](native/README.md) and
[native/BUILD_ANDROID.md](native/BUILD_ANDROID.md). Use `npm run cap:sync`
(regenerates config, then runs `cap sync`). Copy the generated `AppConfig.kt` /
`AppConfig.swift` along with the widget sources. The Android application id is
`com.dailyhow.app`; change it (see `android/app/build.gradle`) before your first
store release. In GitHub Actions, set the `APP_URL` repository variable.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 8080 |
| `npm run build` | Production build |
| `npm start` | Serve the production build (loads `.env`) |
| `npm run config:sync` | Generate widget config, scheduler SQL, `supabase/config.toml` from `.env` |
| `npm run cap:sync` | `config:sync` + `cap sync` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
