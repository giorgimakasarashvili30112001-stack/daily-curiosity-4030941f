# The Daily How

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

`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are baked into the browser bundle
at build time, so rebuild after changing them. Set `NITRO_PRESET` in `.env`
(e.g. `vercel`, `netlify`, `cloudflare-module`) to target another host.

## Daily scheduler

`npm run config:sync` writes `db/generated/daily_scheduler.sql` using your
`APP_URL`. Run that file once in the Supabase SQL editor: it creates a pg_cron
job (00:05 UTC) that calls `/api/public/prewarm` so each day's explainer and
quiz exist even if nobody visits. (Don't run the `.tpl` template directly.)

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
