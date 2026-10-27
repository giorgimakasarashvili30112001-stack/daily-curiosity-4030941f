# Native app + home-screen widget

The web app is deployed separately (see the main README). The native shell and the widgets are built locally
with Capacitor + Xcode/Android Studio.

## 1. Data source

`GET /api/public/today-title` returns:

```json
{ "title": "…", "category": "…", "slug": "…", "date": "2026-08-30" }
```

Both widgets poll this endpoint (~every 30 min). Publish the app so the stable
URL in `capacitor.config.ts` serves the latest build.

## 2. Create the native projects

```bash
git clone <your repo> && cd <repo>
npm install
npx cap add android
npx cap add ios
npm run cap:sync
```

## 3. Android widget

The widget is already part of the Android project (`android/`): the Java class
`com.dailyhow.app.widget.DailyFactWidget`, its layout/background/info resources and the
`<receiver>` in `AndroidManifest.xml`. Nothing to copy. It reads the site address from
`res/values/app_config.xml`, which `npm run config:sync` (also run by the GitHub workflow)
regenerates from `APP_URL`.

To add it on a phone: install the new APK, long-press the home screen, choose Widgets,
find **Daily How**, and drag it onto the screen. It shows today's explainer title,
refreshes every few hours, and tapping it opens the app.

## 4. iOS widget

1. `npx cap open ios`
2. File > New > Target > **Widget Extension**, name it `DailyFactWidget`
   (uncheck "Include Live Activity" and "Include Configuration Intent").
3. Replace the generated Swift file with `native/ios/DailyFactWidget.swift`.
4. Build to a device/simulator, then add the widget from the home screen.

## 5. Changing the domain

Change `APP_URL` in `.env` (and the GitHub variable), then run `npm run config:sync`:
it updates the Capacitor shell, the Android widget (`app_config.xml`) and the iOS widget.

## 6. Daily reminders (local notifications)

The app schedules two local reminders per day (11:00 and 19:00, device time) and
skips them once the day's quiz is answered correctly. Toggle lives on the
Profile tab; it only works in the native build, not the browser.

After `npm run cap:sync`:

- **Android** — the plugin adds `POST_NOTIFICATIONS` (Android 13+) and
  `SCHEDULE_EXACT_ALARM`; verify they are present in `AndroidManifest.xml`.
- **iOS** — in Xcode add the **Push Notifications**-free setup: no capability is
  required for local notifications, but make sure the app is allowed to send
  notifications when the system prompt appears on first toggle.
