---
name: on-device-testing
description: Run and debug Cue Clock on the real Android test phones from the MacBook M1. Use when flashing a build to a device, running the AI E2E harness on hardware, choosing between the stock-Android and HyperOS phone, or hitting adb/Metro/Gradle install problems.
---

# Local On-Device Testing (MacBook M1)

| Role        | Device            | Android     | Skin                | Serial         |
| ----------- | ----------------- | ----------- | ------------------- | -------------- |
| **Primary** | Xiaomi Mi A2 Lite | 10 (API 29) | Android One (stock) | `7dfe965e0405` |
| Secondary   | Redmi Note 12     | 15 (API 35) | HyperOS V816        | `eb5f39be`     |

Use the Mi A2 Lite (near-stock) for day-to-day dev and E2E runs; the Note 12 for HyperOS-specific validation. JDK 17 + Android SDK installed; pin `JAVA_HOME` per-command, don't change the global.

**JS changes:** `./app/scripts/cold-reload.sh` (kills Metro, restarts with `--clear`, re-forwards the port, relaunches) — never trust Metro's warm cache; `--wipe` also `pm clear`s app data to re-fire onboarding.

**Native changes** (Kotlin/Java, app.json, plugins, native deps): `gradlew app:installDebug` with `-PreactNativeArchitectures=arm64-v8a`.

## Gotchas

- `INSTALL_FAILED_VERSION_DOWNGRADE` → uninstall the Play build first.
- Every USB replug breaks `adb reverse` — re-run it.
- `expo prebuild` drops Notifee's local Maven entry from `android/build.gradle` — re-add `maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }` to `allprojects.repositories`.
- Android 10 (Mi A2 Lite) doesn't need `POST_NOTIFICATIONS`.
- HyperOS (Note 12) wipes per-app toggles on every reinstall — re-enable Other Permissions + Autostart + Battery-unrestricted, or background/locked full-screen-intent alarms silently fail.
