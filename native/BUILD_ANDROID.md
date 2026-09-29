# Building The Daily How for Google Play

The store file has to be built on your own computer (Android Studio needs a
real Java + Android SDK install).

## 1. Get the code

```bash
git clone <your repo>
cd <repo>
npm install
```

## 2. Create the Android project

```bash
npx cap add android
npx cap sync android
```

The app loads the hosted site from `capacitor.config.ts`, so no web build is
needed for the shell to work. Deploy the web app first and set `APP_URL` to its origin (e.g. `APP_URL=https://your-domain npx cap sync android`).

## 3. Open it in Android Studio

```bash
npx cap open android
```

Add the home-screen widget files from `native/android/` as described in
`native/README.md`, then let Gradle sync.

## 4. Make the upload file

Google Play requires an **.aab** (Android App Bundle), not an .apk.

Android Studio → **Build → Generate Signed Bundle / APK → Android App Bundle**

- Create a new keystore the first time and keep it safe forever — you need the
  same one for every future update.
- Build variant: **release**.

Result: `android/app/release/app-release.aab` → upload this in the Play Console.

Want a plain .apk for testing on your own phone instead? Same menu, choose
**APK** instead of Android App Bundle.

## 5. Before you submit

- Set a unique application id in `android/app/build.gradle` if
  `com.dailyhow.app` is not the name you want on the store.
- Bump `versionCode` / `versionName` for each new upload.
- Prepare a privacy policy URL, app icon, and screenshots — Play requires them.
