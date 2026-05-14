# Cue Clock — Developer Reference

> ⚠ **Public repo.** No secrets, internal URLs, unreleased names, or partner info in commits.

**Cue Clock** is a minimal, distraction-free clock app built specifically for broadcast professionals who need to monitor multiple timezones and track countdown timers simultaneously.

## Important

- This document must only contain useful information as briefly and concise as possible.
- This application NEEDS to be minimal and fast while being intuitive.

---

## Project Layout

```
app/                            React Native (Expo SDK 55) mobile app
  app/                          Expo Router screens
    _layout.tsx                 Root layout, analytics init
    index.tsx                   HomeScreen — all primary state lives here
  components/                   UI: ClockPicker, TargetBlock, *Modal
  lib/
    alarms.ts                   Notifee wrapper (schedule/cancel/channels/permissions)
    alarmHandlers.ts            Notifee bg/fg event dispatcher + bg vibration loop
    analytics.ts                Firebase/Clarity init
    debugLog.ts                 Ring-buffer logger, gated by EXPO_PUBLIC_DEBUG_LOGS
  modules/expo-alarm-vibrator/  Local native Kotlin module (ALARM-class vibration)
  plugins/withFullScreenAlarm.js  Adds showWhenLocked + turnScreenOn to MainActivity
  constants/                    colors.ts, timezones.ts (18 zones)
  assets/                       icons, splash, SpaceMono, alarm.mp3
website/                        Next.js 16 landing page (Tailwind 4, GSAP)
.github/workflows/
  android-internal.yml          push→master → signed AAB → Play internal track
  android-release.yml           GH Release → signed AAB → Play beta track
```

---

## Tech Stack (Mobile)

React Native 0.83, Expo SDK 55, TypeScript 5.9 (strict), Expo Router, Luxon 3, AsyncStorage, `@notifee/react-native` 9.1.8, `expo-audio` 55, `@react-native-firebase/*`, `@microsoft/react-native-clarity`.

Styling: inline `style={...}` only (no StyleSheet libraries). Colors via `app/constants/colors.ts`. Safe area via `useSafeAreaInsets()` — never hardcode insets.

---

## Architecture

**State.** All app state lives on `HomeScreen` (`app/app/index.tsx`) and persists to AsyncStorage via `multiSet`/`multiGet`. Rehydrated on mount.

Key persisted keys: `zone1`, `zone2`, `targetBlocks`, `is24Hour`, `alertMode` (`"notification"` | `"alarm"`), `analyticsEnabled` (3-state: null = unasked), `androidBackgroundHelpSeen`.

**Reset preserves `analyticsEnabled`** — `doReset` uses `multiRemove` on specific keys, not `clear`.

**Countdown.** `setInterval(1s)` in HomeScreen. Per-block: target time in zone, +1 day if past, minus deduction, formatted `HH:MM:SS`. Skip React reconciliation if formatted string didn't change.

**Fire-and-forget async.** `handleTargetConfirm`, `handleAlertConfirm`, `removeBlock` update state synchronously, then reschedule notifications in a background IIFE so UI stays <16ms.

---

## Alert System

Dual-mode, Android-first.

### Alarm Mode (Android, primary)

Full-screen alarm UX that wakes the device and shows over lock screen. Audio (`expo-audio` looping `assets/alarm.mp3`) and vibration (local `expo-alarm-vibrator` module) are owned by `AlarmDismissModal` in-activity — Android suppresses channel sound the moment FSI launches an Activity, so the channel config is fallback only. **60s safety cap** prevents an unattended phone from sounding forever.

**Notifee config quirks that matter:**

- `fullScreenAction.launchActivity` and `pressAction.launchActivity` MUST be the fully-qualified class name (`com.yanukadeneth99.cueclock.MainActivity`). HyperOS/Android 14+ silently refuses to elevate FSI with `"default"`.
- `vibrationPattern` must be an even-length array of strictly-positive values (e.g. `[500, 500, 500, 500]`, NOT `[0, 500, …]`). Bad pattern throws synchronously inside `createChannel`/`createTriggerNotification`.
- Channel IDs versioned: `cue-clock-alarm-v3`, `cue-clock-notif-v3`. Android channels are immutable post-creation; v1/v2 IDs are explicitly deleted on first run.
- Trigger uses `AlarmManager.SET_EXACT_AND_ALLOW_WHILE_IDLE` (survives Doze).

**Three modal-mount paths** (every alarm fire reaches the modal regardless of OS state):

1. **Foreground tick** — countdown ticker at `alert:shouldFire` queues into `alertQueueRef`.
2. **Cold start via FSI** — `notifee.getInitialNotification()` read after AsyncStorage hydration mounts modal with stored block context.
3. **Warm resume** — alarm fires while backgrounded; ticker records into `pendingBackgroundFiresRef` (`alert:bgFireRecorded`). On `AppState=active`, ref is drained (`appState:resume:drainBgFires`) → modal mounts. Defensive `fireDate === null` path (`appState:resume:fallbackQueueModal`) covers locked-screen case where the JS ticker was suspended.

**Background heads-up vibration** (`lib/alarmHandlers.ts`). When the OS downgrades FSI to a plain heads-up (Android 14+ refuses to launch Activity when screen is on + another app focused — documented, not overridable), `onBackgroundEvent` watches for `EventType.DELIVERED` on the alarm channel and starts a 1.2s `AlarmVibrator.vibrateAsAlarm(600)` loop with a 60s cap. Loop self-cancels on `AppState=active`, `DISMISSED`, or `ACTION_PRESS`.

**Snooze.** `MAX_SNOOZES = Number.POSITIVE_INFINITY`. Modal shows "Snoozed N times" once N > 0. `snoozeCount` resets to 0 in `handleAlertConfirm` when a new alert is configured.

**Required permissions:** `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`. Runtime checks: `canScheduleExactAlarms()`, `canUseFullScreenIntent()`. Both deep-link to settings if missing.

### Notification Mode (fallback)

Heads-up only, channel `cue-clock-notif-v3`. Same exact-alarm trigger.

### Web/iOS

Web Notifications API → `window.alert` as final fallback. iOS uses `expo-notifications`.

---

## ALARM-class Vibration (`modules/expo-alarm-vibrator`)

Local Expo native module. Dispatches `Vibrator.vibrate(VibrationEffect, AudioAttributes.USAGE_ALARM)`. Without this, RN's `Vibration.vibrate(ms)` is classified `mUsage=TOUCH` and rejected by Xiaomi/HyperOS `VibratorService` with `IGNORED_FOR_SETTINGS` when "Vibrate on Tap" is off. The ALARM usage class is gated by `alarm_vibration_intensity` (default-on across virtually all devices).

**API:** `AlarmVibrator.vibrateAsAlarm(durationMs)`, `AlarmVibrator.cancel()`.

**Verification in logcat:** `mUsage=ALARM ... status FINISHED`. Failure mode: `mUsage=TOUCH ... IGNORED_FOR_SETTINGS` means JS still using `Vibration.vibrate()` somewhere.

Registered via Expo autolinking (`expo-module.config.json` + `file:` dep in `app/package.json`). Survives `expo prebuild --clean`.

---

## Debug Log (`lib/debugLog.ts`, `components/DebugLogModal.tsx`)

In-memory ring buffer (200 entries). **Gated three ways for release safety:**

1. Build-time env var `EXPO_PUBLIC_DEBUG_LOGS=1` (only set by `android-internal.yml`, NEVER by `android-release.yml`).
2. `dlog()` short-circuits to no-op when flag unset.
3. UI: `onTestAlarm`/`onShowDebugLog` props are `undefined` in release, hiding the Help-modal row entirely.

**Access on internal builds:** Help (?) → row below "About the Developer" → Test Alarm / Debug Log buttons.

Log at platform/permission boundaries. Never at 1s-tick hot loops.

---

## Onboarding Flow (Android, first launch)

Two-step wizard:

1. `AndroidBackgroundHelpModal` — 4 numbered StepCards with sub-bullets and deep-links: (1) Notifications + full-screen + battery via App Settings, (2) Exact Alarms, (3) **HyperOS Other Permissions** (Show on Lock screen + Display pop-up + Start in background), (4) MIUI Autostart. Color-emphasis: warning for Other Permissions, danger for Autostart. **Continue button is scroll-gated** — starts as a grey "Scroll down" label, flips to coloured "Continue" once the user reaches the bottom (16px slack). `onLayout` / `onContentSizeChange` auto-unlock when content fits without scrolling.
2. `AnalyticsConsentModal` — non-dismissable opt-in. Opens automatically when step 1 closes IF `analyticsEnabled === null`.

The native notification-permission dialog and the "Allow Exact Alarms" Alert are deliberately suppressed on first launch (in `app/index.tsx` we only call `getPermissionsAsync`, never `requestPermissionsAsync`). The wizard's deep-links cover the same ground without fragmenting the UX.

iOS/web skip step 1.

---

## Expo Config Plugin

`plugins/withFullScreenAlarm.js` — adds `android:showWhenLocked="true"` and `android:turnScreenOn="true"` to MainActivity. Android-only, no-op elsewhere.

---

## CI/CD

| Trigger           | Workflow               | Track                 |
| ----------------- | ---------------------- | --------------------- |
| Push to `master`  | `android-internal.yml` | Internal Testing      |
| Create GH Release | `android-release.yml`  | Closed Testing (Beta) |

Both: Ubuntu 24.04, JDK 17, Node 22, Android SDK 35. Steps: `npm ci` → `expo prebuild --platform android --clean` → restrict to `arm64-v8a` → decode Firebase + keystore from Base64 secrets → `gradlew bundleRelease` → upload via Play service account.

**Workflow env var:** `EXPO_PUBLIC_DEBUG_LOGS=1` set ONLY in `android-internal.yml`.

Required secrets: `EXPO_PUBLIC_CLARITY_KEY`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `GOOGLE_SERVICES_JSON_BASE64`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `EAS_PROJECT_ID`, `EAS_OWNER`. Package: `com.yanukadeneth99.cueclock`.

---

## Local On-Device Testing (MacBook M1 → Redmi Note 12 / Android 15 / HyperOS V816)

This device is the worst-case calibration target — almost every gotcha was found here. JDK 17 (Temurin) and Android SDK already installed; we pin `JAVA_HOME` per-command rather than changing the global.

### One-time

```bash
brew install --cask android-platform-tools
# Phone: Developer Options → USB debugging + Install via USB → plug in → Allow
adb devices -l   # should list device as "device"
```

### Native rebuild (changed Kotlin/Java, app.json, plugins, native dep)

```bash
cd app/android
JAVA_HOME=$(/usr/libexec/java_home -v 17) \
PATH=$(/usr/libexec/java_home -v 17)/bin:$PATH \
./gradlew app:installDebug -x lint -x test --build-cache -PreactNativeArchitectures=arm64-v8a
```

Arm64-only build cuts first-build to ~5min, incremental to ~90s.

### Metro + JS hot reload

```bash
cd app
JAVA_HOME=$(/usr/libexec/java_home -v 17) \
PATH=$(/usr/libexec/java_home -v 17)/bin:$PATH \
EXPO_PUBLIC_DEBUG_LOGS=1 CI=1 \
npx expo start --dev-client --clear

adb reverse tcp:8081 tcp:8081
adb shell am force-stop com.yanukadeneth99.cueclock
adb shell monkey -p com.yanukadeneth99.cueclock -c android.intent.category.LAUNCHER 1
```

`CI=1` avoids interactive prompts. `--clear` is required when a stale bundle is served. `EXPO_PUBLIC_DEBUG_LOGS=1` enables the in-app log button locally.

### Logcat (second terminal)

```bash
adb logcat -c
adb logcat \
  ReactNativeJS:V NotifeeApiModule:V NotifeeCore:V Notifee:V \
  NotificationService:V AlarmManager:V \
  VibratorService:V VibratorManagerService:V Vibrator:V \
  ActivityManager:I ActivityTaskManager:I \
  '*:S' > /tmp/cueclock-logcat.txt
```

In-app `dlog` shows what JS sees; logcat shows what the OS does (channel vibration accept/reject, AlarmManager fires, FSI Activity launches).

### Gotchas

- **`INSTALL_FAILED_VERSION_DOWNGRADE`** — Play Store version installed. `adb uninstall com.yanukadeneth99.cueclock` (wipes state).
- **HyperOS Second Space leftover** — Play refuses install citing "incompatible version" even after normal uninstall. Check `adb shell pm list users`; if `10:security space` exists, `adb shell pm uninstall --user 10 com.yanukadeneth99.cueclock`.
- **Replug drops tunnel** — every USB unplug breaks `adb reverse`. Re-run after every reconnect.
- **Stale bundle with `CI=1`** — Metro doesn't watch files. Kill Metro by port and restart with `--clear`.
- **Notifee `app.notifee:core:+` not found** — `expo prebuild` regenerates `android/build.gradle` without Notifee's local Maven entry. Add to `allprojects.repositories`:

  ```gradle
  maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }
  ```

  (TODO: convert to config plugin for durability.)

- **HyperOS settings reset on reinstall** — every fresh APK install wipes per-app HyperOS toggles. Re-enable Other Permissions + Autostart + Battery unrestricted, or background/locked FSI silently fails.

### Diagnostic one-liners

```bash
# Granted permissions
adb shell dumpsys package com.yanukadeneth99.cueclock | \
  grep -E "VIBRATE|FULL_SCREEN|POST_NOTIFICATIONS|WAKE_LOCK|SCHEDULE_EXACT|RECEIVE_BOOT"

# System vibration gates (TOUCH vs ALARM vs NOTIFICATION)
adb shell settings list system | grep -i 'vib\|haptic'

# showWhenLocked / turnScreenOn on installed MainActivity
AAPT=$(find ~/Library/Android/sdk/build-tools -name aapt2 | sort -V | tail -1)
"$AAPT" dump xmltree app/android/app/build/outputs/apk/debug/app-debug.apk \
  --file AndroidManifest.xml | grep -A6 "MainActivity"
```

---

## Conventions

- **TypeScript strict.** `T[]` not `Array<T>`. `Pressable` not `Button`.
- **Components.** Function declarations for default exports. Handlers in `useCallback`. `React.memo` on list items (`TargetBlock`).
- **Error handling.** Empty/commented `catch` for production silence. No `console.log` — use `dlog` at boundaries.
- **Naming.** `camelCase` vars/functions, `UPPER_SNAKE_CASE` constants, `PascalCase` types.
- **Imports.** Absolute aliases (`@/components/`, `@/constants/`).
- **`(window as any).Notification` and `onHoverIn as any`** are intentional RN-Web escape hatches — leave them.

### Git

- **No `Co-Authored-By: Claude`/`Anthropic` trailers in commits.** Ever.
- **Confirm before committing to `master`/`main`/`production`.**

---

## License

AGPL-3.0. Commercial: <hello@yashura.io>. Security reports: see `SECURITY.md`.
