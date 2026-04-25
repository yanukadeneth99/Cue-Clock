# Development Guide

This guide explains how to set up and run Cue Clock locally for development and testing.

## Quick Start (No External Dependencies)

You can run and test the app locally **without any environment variables**. All optional features (analytics, signing, EAS) are gracefully disabled.

### Prerequisites

- **Node.js 22+** and **npm**
- **Java 17+** (for Android development)
- **Android SDK** (for Android emulator)
- **Xcode** (macOS only, for iOS development)

### 1. Install Dependencies

```bash
cd app
npm ci
```

### 2. Start the Development Server

```bash
npx expo start
```

### 3. Run on Android

In another terminal:

```bash
npx expo run:android
```

Or use the Expo CLI menu to select the platform.

### 4. Run on iOS

```bash
npx expo run:ios
```

### 5. Run on Web

Press `w` in the Expo CLI menu, or:

```bash
npx expo run:web
```

---

## Optional: Enable Analytics (Local Development)

If you want to test analytics locally, create an `.env` file in the `app/` directory:

```bash
cp .env.example .env
```

Then edit `.env` and add your Microsoft Clarity project ID:

```
EXPO_PUBLIC_CLARITY_KEY=your_clarity_project_id_here
```

Without this, analytics initialization is safely skipped.

---

## Optional: Build Release APK (Android)

To test a release-signed APK locally, you'll need signing credentials. Follow the Expo documentation:

1. Generate a keystore: https://docs.expo.dev/guides/android-developers/
2. Create `.env` with:
   ```
   ANDROID_KEYSTORE_BASE64=<base64-encoded-keystore>
   ANDROID_KEYSTORE_PASSWORD=<password>
   ANDROID_KEY_ALIAS=<alias>
   ANDROID_KEY_PASSWORD=<password>
   ```
3. Build:
   ```bash
   cd app/android
   ./gradlew bundleRelease \
     -Pandroid.injected.signing.store.file=path/to/release.keystore \
     -Pandroid.injected.signing.store.password=<password> \
     -Pandroid.injected.signing.key.alias=<alias> \
     -Pandroid.injected.signing.key.password=<password>
   ```

**Note:** For local testing, debug builds are sufficient and don't require signing.

### Docker Dry-Run For Release Builds

If you want to validate the Android release pipeline locally without installing the Android toolchain on your machine, use Docker:

```bash
bash scripts/android-release-dry-run-docker.sh v0.0.24
```

What it does:

- Builds a dedicated Android build container
- Reproduces the release version stamping flow used by GitHub Actions
- Generates a temporary local keystore for signing
- Builds a release `.aab`
- Verifies that the built bundle contains the expected Android `versionName`

Notes:

- If `app/google-services.json` is missing, the dry-run creates a placeholder file so the build can still proceed
- The output bundle is copied to `.artifacts/android-release-dry-run/`
- You can override the generated version code with `VERSION_CODE=123456 bash scripts/android-release-dry-run-docker.sh v0.0.24`

---

## Optional: Use Custom EAS Configuration

By default, local builds use placeholder EAS values:

- `projectId`: `dev-local-open-source`
- `owner`: `open-source-contributor`

These allow the app to build and run locally without Expo EAS account access.

To use your own EAS account for builds:

1. Create `.env`:

   ```
   EAS_PROJECT_ID=<your-project-id>
   EAS_OWNER=<your-username>
   ```

2. Rebuild the native project:
   ```bash
   npx expo prebuild --platform android --clean
   ```

---

## Common Commands

| Command                                        | Purpose                                  |
| ---------------------------------------------- | ---------------------------------------- |
| `npx expo start`                               | Start the development server             |
| `npx expo run:android`                         | Build and run on Android emulator/device |
| `npx expo run:ios`                             | Build and run on iOS simulator/device    |
| `npx expo run:web`                             | Start web server                         |
| `npm run lint`                                 | Run ESLint                               |
| `npx expo prebuild --platform android --clean` | Regenerate native Android project        |
| `npx expo doctor`                              | Diagnose setup issues                    |

---

## Firebase Configuration

The app uses Firebase for crash reporting. The `google-services.json` file is excluded from the repository for security.

For local development:

- If you don't have `google-services.json`, the app will still run (Firebase initialization is handled gracefully)
- Firebase SDK will warn about missing config, but the app functions normally

If you want to enable Firebase locally:

1. Create a Firebase project at https://console.firebase.google.com
2. Download `google-services.json` from your Firebase Console
3. Place it in the `app/` directory

---

## Troubleshooting

### "google-services.json not found"

This is expected. The file is `.gitignored` for security. Either:

- Create your own Firebase config, or
- Ignore the warning and run the app anyway (Firebase is optional)

### "Clarity key not found"

Also expected. Analytics are optional. Run the app without it, or add your Clarity project ID to `.env`.

### "Module not found" errors

Run `npm ci` in the `app/` directory to ensure all dependencies are installed.

### Emulator not starting

Ensure your Android emulator is running before executing `npx expo run:android`. Check Android Studio's AVD Manager.

---

## Testing on Real Devices

### Android Device

1. Enable Developer Mode on your device (tap Build Number 7 times in Settings)
2. Enable USB Debugging
3. Connect via USB
4. Run `npx expo run:android`; it will detect your device

### iOS Device

Requires an Apple Developer account. See Expo's guide: https://docs.expo.dev/guides/ios-development/

---

## Contributing

Please see the main [README.md](./README.md) for contribution guidelines.

When submitting PRs:

- Do not commit `.env` files
- Do not commit `google-services.json`
- Do not commit `release.keystore` or signing credentials
- All contributions should work with the minimal setup (no external dependencies required)

---

## CI/CD Pipeline

The GitHub Actions workflows automatically build and deploy to Google Play. See `.github/workflows/` for details.

- **Internal Testing**: Triggered on every push to `master`
- **Beta Release**: Triggered on GitHub Release creation

These workflows securely inject credentials via GitHub Secrets; they are never committed to the repository.

There is also a pull request validation workflow at `.github/workflows/android-release-verify.yml` that dry-runs the Android release build and checks the produced bundle version metadata without uploading to Google Play.
