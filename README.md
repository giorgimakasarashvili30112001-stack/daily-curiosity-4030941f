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

## Setup

1. **Install**
   ```sh
   npm install
   ```
2. **Configure environment.** Copy `.env.example` to `.env` and fill it in.
   `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are secrets: keep them
   server-side and never commit them.
3. **Create the database.** In the Supabase SQL editor, run the files in
   `supabase/migrations/`, then `ANON_CONTENT_POLICIES.sql` and anything in
   `db/`.
4. **Enable auth providers** in Supabase (Email, and Google if wanted). Under
   *Authentication → URL Configuration* set the Site URL and redirect URLs to
   your deployed domain (and `http://localhost:8080` for development).
5. **Run**
   ```sh
   npm run dev      # http://localhost:8080
   ```

## Build & deploy

```sh
npm run build
npm start          # runs .output/server/index.mjs (Node server)
```

The build uses a Nitro preset, `node-server` by default. To target another host
set `NITRO_PRESET` when building, for example:

```sh
NITRO_PRESET=vercel npm run build
NITRO_PRESET=netlify npm run build
NITRO_PRESET=cloudflare-module npm run build
```

Set the same environment variables from `.env.example` on your host.

## Daily scheduler

`DAILY_SCHEDULER_SETUP.sql` creates a pg_cron job (00:05 UTC) that calls
`/api/public/prewarm` so each day's explainer and quiz exist even if nobody
visits. Replace `YOUR-DOMAIN` in the file with your deployed domain, then run it
once in the Supabase SQL editor.

## Native app

See [native/README.md](native/README.md) and
[native/BUILD_ANDROID.md](native/BUILD_ANDROID.md). Set `APP_URL` to your
deployed origin before `npx cap sync`, and set the same origin in
`native/android/DailyFactWidget.kt` and `native/ios/DailyFactWidget.swift`.
The Android application id is `com.dailyhow.app`; change it (see
`android/app/build.gradle`) before your first store release.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 8080 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
