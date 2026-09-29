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
npx cap sync
```

## 3. Android widget

Copy from `native/android/` into the generated project:

| File | Destination |
| --- | --- |
| `DailyFactWidget.kt` | `android/app/src/main/java/com/dailyhow/app/widget/` |
| `daily_fact_widget.xml` | `android/app/src/main/res/layout/` |
| `daily_fact_widget_info.xml` | `android/app/src/main/res/xml/` |
| `widget_background.xml` | `android/app/src/main/res/drawable/` |
| `AndroidManifest.snippet.xml` | paste the `<receiver>` into `AndroidManifest.xml` inside `<application>` |

Add the coroutines dependency in `android/app/build.gradle`:

```gradle
implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1"
```

Then run from Android Studio and long-press the home screen to add the widget.

## 4. iOS widget

1. `npx cap open ios`
2. File > New > Target > **Widget Extension**, name it `DailyFactWidget`
   (uncheck "Include Live Activity" and "Include Configuration Intent").
3. Replace the generated Swift file with `native/ios/DailyFactWidget.swift`.
4. Build to a device/simulator, then add the widget from the home screen.

## 5. Changing the domain

Update the URL in three places when you move to a custom domain:
`capacitor.config.ts`, `DailyFactWidget.kt` (`APP_ORIGIN`), and
`DailyFactWidget.swift` (`appOrigin`).

## 6. Daily reminders (local notifications)

The app schedules two local reminders per day (11:00 and 19:00, device time) and
skips them once the day's quiz is answered correctly. Toggle lives on the
Profile tab; it only works in the native build, not the browser.

After `npx cap sync`:

- **Android** — the plugin adds `POST_NOTIFICATIONS` (Android 13+) and
  `SCHEDULE_EXACT_ALARM`; verify they are present in `AndroidManifest.xml`.
- **iOS** — in Xcode add the **Push Notifications**-free setup: no capability is
  required for local notifications, but make sure the app is allowed to send
  notifications when the system prompt appears on first toggle.
