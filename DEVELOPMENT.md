# Development Guide

How to run Cue Clock locally. No environment variables are needed. Analytics, signing and EAS are skipped when their settings are missing.

## Prerequisites

- Node.js 22+ and npm
- Java 17+ and the Android SDK (Android)
- Xcode (iOS, macOS only)

## Run the app

```bash
cd app
npm ci
npx expo start
```

Then press `a` for Android, `i` for iOS or `w` for web. You can also run `npx expo run:android`, `npx expo run:ios` or `npx expo run:web`.

For a real Android phone, turn on Developer Mode and USB debugging, plug it in and run `npx expo run:android`. iOS devices need an Apple Developer account, see [Expo's guide](https://docs.expo.dev/guides/ios-development/).

## Common commands

| Command | Purpose |
| --- | --- |
| `npx expo start` | Start the development server |
| `npx expo run:android` | Build and run on Android |
| `npx expo run:ios` | Build and run on iOS |
| `npx expo run:web` | Start the web server |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Type check |
| `npx expo prebuild --platform android --clean` | Regenerate the native Android project |
| `npx expo doctor` | Diagnose setup issues |

## Optional settings

- **Analytics:** copy `app/.env.example` to `app/.env` and set `EXPO_PUBLIC_CLARITY_KEY` to your Microsoft Clarity project ID.
- **Firebase crash reports:** download `google-services.json` from your Firebase project and put it in `app/`. Without it the app still runs.
- **EAS:** local builds use placeholder values. To use your own account, set `EAS_PROJECT_ID` and `EAS_OWNER` in `.env`, then run `npx expo prebuild --platform android --clean`.
- **Signed release build:** debug builds are enough for local testing. For a signed one, follow the [Expo guide](https://docs.expo.dev/guides/android-developers/) and set `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` in `.env`.

Never commit `.env`, `google-services.json` or keystores.

## Troubleshooting

- A missing `google-services.json` or Clarity key warning is expected. Both are optional.
- "Module not found": run `npm ci` in `app/`.
- Emulator not starting: start it from Android Studio's AVD Manager before `npx expo run:android`.

## Testing

Tests use [Maestro](https://maestro.mobile.dev) on a real Android phone. See [tests/maestro/README.md](./tests/maestro/README.md).

The helper scripts in `.github/scripts` have small tests. Run them with `node --test .github/scripts/lib/*.test.js`.

## Releases

GitHub Actions build the app, see `.github/workflows/`. Secrets live in GitHub Secrets and are never committed.

- **Internal:** every push to `master` goes to the Google Play Internal Testing track.
- **Beta:** publishing a pre-release by hand (tag `vX.Y.Z-beta.N`) goes to Open Testing.
- **Production:** turning that pre-release into a full release promotes the same build to Production and deploys the web app.

Pull requests also run `android-release-verify.yml`, which dry-runs the release build without uploading anything.
