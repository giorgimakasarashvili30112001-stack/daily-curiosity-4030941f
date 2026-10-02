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
npm run cap:sync -- android
```

The app loads the hosted site from `capacitor.config.ts`, so no web build is
needed for the shell to work. Deploy the web app first, set `APP_URL` in `.env` to its origin, then run `npm run cap:sync`.

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

## GitHub Actions builds: installing the APK

The workflow (`.github/workflows/build-android.yml`) uploads three artifacts:
`app-debug-apk`, `app-release-apk` and `app-release-aab`.

- GitHub downloads artifacts as a **.zip**. Unzip it first; the `.apk` is
  inside. Installing the zip itself gives "package appears to be invalid".
- To install on a phone, enable "Install unknown apps" for your browser/files
  app, then open the `.apk`.
- Without signing secrets, the release APK is signed with a throwaway **debug**
  key so it installs. Each CI run generates a new debug key, so installing a
  newer build over an older one fails until you uninstall the old app first.
  The AAB is also debug-signed and **cannot be uploaded to the Play Store**.

### Real signing key (needed for stable updates and the Play Store)

Create a keystore once, on your own machine, and back it up somewhere safe
(if you lose it you can never update the app under the same listing):

```sh
keytool -genkeypair -v -keystore release.keystore -alias dailyhow \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore > release.keystore.b64   # macOS: base64 -i release.keystore
```

Then add four **secrets** in GitHub (Settings → Secrets and variables →
Actions → **Secrets**):

| Secret | Value |
| --- | --- |
| `KEYSTORE_FILE` | contents of `release.keystore.b64` |
| `KEYSTORE_PASSWORD` | the keystore password you chose |
| `KEY_ALIAS` | `dailyhow` (or the alias you used) |
| `KEY_PASSWORD` | the key password you chose |

The workflow then signs release builds with it automatically and verifies the
signature. Never commit the keystore file.

### Troubleshooting: "keystore password was incorrect"

The workflow step **Prepare signing keystore** checks the four secrets and
reports which one is wrong. Common causes:

- **Invisible space/newline in the secret.** Handled automatically now.
- **Key password vs keystore password.** Modern keystores are PKCS12, which
  ignores a separate "key password": if `keytool` asked for one and you typed
  something different, use the *keystore* password for both `KEYSTORE_PASSWORD`
  and `KEY_PASSWORD`.
- **Different keystore file / unusual characters.** If you created several
  keystores, you may have encoded an older one. Use a letters-and-digits-only
  password (symbols and non-English characters get mangled on Windows). The
  quickest fix is to create a new keystore and replace all four secrets.
- **Damaged `KEYSTORE_FILE`.** The base64 text must be pasted completely; re-create
  it with the command above if the message says the file is damaged.
- **Wrong alias.** `KEY_ALIAS` must be one of the aliases shown in the error
  (check with `keytool -list -keystore release.keystore`).
- **Secret under the wrong tab or misspelled.** They must be *Repository secrets*
  named exactly `KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.

To test the password locally: `keytool -list -keystore release.keystore`.
