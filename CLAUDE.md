# Cue Clock - Developer Reference

> ⚠ **Public repo.** No secrets, internal URLs, unreleased names, or partner info in commits.

**Cue Clock** is a minimal, distraction-free clock app built specifically for broadcast professionals who need to monitor multiple timezones and track countdown timers simultaneously.

## Important

- This document must only contain useful information as briefly and concise as possible.
- This application NEEDS to be minimal and fast while being intuitive.
- The timers need to be working perfectly, including the zone time.

---

## Project Layout

```
app/                            React Native (Expo SDK 55) mobile app
  app/                          Expo Router screens
    _layout.tsx                 Root layout, analytics init, useFonts gate
    index.tsx                   HomeScreen - all primary state lives here
  components/                   UI primitives + modals (see below)
    Header                      brand dot + wordmark + Help/Settings/Fullscreen
    ClockRail                   two-zone live clocks (tap → ZonePickerModal)
    PrimaryCard                 "Up Next" card, continuous urgency scaling
    PassedStrip                 compressed one-line strip for cues that just crossed zero (× deletes w/ confirm, auto-expires after 5 min)
    QueuedRow                   compact secondary cue row (list is auto-sorted by remaining time)
    AddCueButton                pinned-bottom accent CTA, safe-area aware
    OnAirView                   fullscreen broadcast layout, auto-dimming exit
    ModalShell                  shared bottom-sheet chrome (handle / title / body / footer); wraps content in `KeyboardAvoidingView` (padding iOS / height Android) so any TextInput stays above the keyboard - every modal in the app inherits this
    CueEditModal                unified add/edit cue sheet
    ZonePickerModal             search + 23-IANA-tz picker
    SettingsModal               grouped settings (preferences / zones / display / alerts / system)
    HelpModal                   "How to use" - glossary + Android warning + about
    AndroidBackgroundHelpModal  5-step setup wizard (Xiaomi/MIUI critical)
    AlarmDismissModal           full-screen alarm; snooze count is informational
    AnalyticsConsentModal       first-launch opt-in
    AnalyticsOptOutModal        Settings → Turn off confirmation
    DebugLogModal               internal-build ring-buffer viewer
    TimeStepper                 chevron stepper + tap-to-native-picker (hm / ms)
    TargetBlock, AlertModal,    legacy editor surfaces - only the web /
      ClockPicker, ConfirmModal   fullscreen-web branch still consumes them
  lib/
    alarms.ts                   Notifee wrapper (schedule/cancel/channels/permissions)
    alarmHandlers.ts            Notifee bg/fg event dispatcher + bg vibration loop
    analytics.ts                Firebase/Clarity init
    debugLog.ts                 Ring-buffer logger, gated by EXPO_PUBLIC_DEBUG_LOGS
    time.ts                     formatInZone, fmtHM, zoneAbbr, shortCity, computeCountdown
    urgency.ts                  urgencyFactor (0→1 over 300s→60s window) + lerp helpers
    useNow.ts                   wall-clock-aligned 1s ticker (first tick on second boundary)
  modules/expo-alarm-vibrator/  Local native Kotlin module (ALARM-class vibration)
  plugins/withFullScreenAlarm.js  Adds showWhenLocked + turnScreenOn to MainActivity
  constants/                    colors.ts, typography.ts, timezones.ts (23 zones)
  assets/                       icons, splash, SpaceMono, alarm.mp3 (Inter via @expo-google-fonts/inter)
website/                        Next.js 16 landing page (Tailwind 4, GSAP)
                                Tokens mirror app/constants/colors.ts via @theme in globals.css
.github/
  workflows/
    android-internal.yml        push→master → signed AAB → Play Internal Testing
    android-beta.yml            GH pre-release (vX.Y.Z-beta.N) → signed AAB → Play Open Testing
    android-promote.yml         GH full release (vX.Y.Z) → promote beta AAB → Play Production (no rebuild)
    android-release-verify.yml  PR dry-run of the release build pipeline (throwaway keystore)
    web-deploy.yml              GH full release (vX.Y.Z) → triggers Coolify deploy of the web app
  scripts/
    promote-to-production.js    googleapis-based promotion logic invoked by android-promote.yml
```

---

## Tech Stack (Mobile)

React Native 0.83, Expo SDK 55, TypeScript 5.9 (strict), Expo Router, Luxon 3, AsyncStorage, `@notifee/react-native` 9.1.8, `expo-audio` 55, `@react-native-firebase/*`, `@microsoft/react-native-clarity`.

Styling: inline `style={...}` only (no StyleSheet libraries). Colors via `app/constants/colors.ts`, typography via `app/constants/typography.ts`. Safe area via `useSafeAreaInsets()` - never hardcode insets.

---

## Design System

Three-tier surface stack: `page` (#0a0b0e) → `background` (#1a1d23, default screen bg) → `surface` (#252830, cards/sheets). Single blue `accent` (#60a5fa) for CTA + brand. Amber `countdown` (#fbbf24) is reserved for time-urgency + alarm state only. Red `danger` (#ef4444) is reserved for <1m critical + destructive actions only. Zone dots: `zone1` green / `zone2` red.

**Typography.** Inter for all UI (weights 400/500/600/700 loaded via `@expo-google-fonts/inter`). Space Mono for all numerics (`SpaceMono-Regular.ttf` bundled). Always pair clock/countdown displays with `fontVariantNumeric: 'tabular-nums'` (already wired in the `text.*` presets in `constants/typography.ts`) so digit changes don't shift layout.

**Continuous urgency scaling.** The home `PrimaryCard` and `OnAirView` hero card interpolate font size, padding, and the amber halo radius from a single `urgencyFactor(total)` - 0 when calm (>5 min), 1 in the last minute, linear across the 300s→60s window. Border and background swap discretely at the warn / crit thresholds; the size growth is continuous. Implemented in `app/lib/urgency.ts`.

**Web parity.** The Next.js landing (`website/`) mirrors the same tokens via Tailwind 4 `@theme` in `src/app/globals.css`. New token names: `bg-page`, `bg-bg-app`, `bg-card`, `border-card-border`, `text-fg`, `text-fg-muted`, `text-accent`, `bg-zone1`, `bg-zone2`, `bg-countdown`, `bg-danger`, plus `cta-primary` and `surface-card` component utilities. The legacy Material-3 token block is still present, labelled "slated for removal" - kept only to keep the `/privacy` page rendering until it's restyled.

**Render branches.** `app/app/index.tsx` ships three render paths:

- `!isWeb && !fullScreen` → new-design mobile home (Header + ClockRail + PrimaryCard + QueuedRow + AddCueButton; modals via `ModalShell`).
- `!isWeb && fullScreen` → `OnAirView`.
- `isWeb` (any) → legacy render path (still uses `ClockPicker` + `TargetBlock` + `AlertModal` + `ConfirmModal`). Slated for migration in a follow-up.

---

## Architecture

**State.** All app state lives on `HomeScreen` (`app/app/index.tsx`) and persists to AsyncStorage via `multiSet`/`multiGet`. Rehydrated on mount.

Key persisted keys: `zone1`, `zone2`, `targetBlocks`, `is24Hour`, `alertMode` (`"notification"` | `"alarm"`), `showSeconds`, `soundAlerts`, `keepOn`, `analyticsEnabled` (3-state: null = unasked), `androidBackgroundHelpSeen`.

**Reset preserves `analyticsEnabled`** - `doReset` uses `multiRemove` on specific keys, not `clear`.

**Countdown.** `setInterval(1s)` in HomeScreen. Per-block: target time in zone, +1 day if past, minus deduction, formatted `HH:MM:SS`. Skip React reconciliation if formatted string didn't change.

**Fire-and-forget async.** `handleTargetConfirm`, `handleAlertConfirm`, `removeBlock` update state synchronously, then reschedule notifications in a background IIFE so UI stays <16ms.

**Passed-cue rotation.** `computeCountdown` rolls past zero to ~86400 (next-day rollover), so "expired" isn't a native state. `HomeScreen` watches the per-block prev≤5s → next≥86395s transition each tick via `lastTotalsRef` and stamps the id into a `passedAt: Record<id, ms>` map. The render path filters those ids out of the primary/queue split and renders them as `PassedStrip`s above the (new) primary card - promoting the next cue automatically. Entries auto-evict after `PASSED_TTL_MS` (5 min); × on the strip evicts immediately. Strips never reschedule alarms - they're a pure presentation layer.

**Auto-sort by remaining time.** The render path sorts active blocks by `computeCountdown(...).total` ascending each tick - soonest cue is always primary, the rest fall in line below it. Zones are not part of the sort key: `computeCountdown` already projects each target into its own zone, so `total` is in real wall-clock seconds-from-now regardless of where the cue lives. The persisted order in `targetBlocks` no longer drives display; cues are reordered purely visually as time advances.

---

## Alert System

Dual-mode, Android-first.

### Alarm Mode (Android, primary)

Full-screen alarm UX that wakes the device and shows over lock screen. Audio (`expo-audio` looping `assets/alarm.mp3`) and vibration (local `expo-alarm-vibrator` module) are owned by `AlarmDismissModal` in-activity - Android suppresses channel sound the moment FSI launches an Activity, so the channel config is fallback only. **60s safety cap** prevents an unattended phone from sounding forever.

**Notifee config quirks that matter:**

- `fullScreenAction.launchActivity` and `pressAction.launchActivity` MUST be the fully-qualified class name (`com.yanukadeneth99.cueclock.MainActivity`). HyperOS/Android 14+ silently refuses to elevate FSI with `"default"`.
- `vibrationPattern` must be an even-length array of strictly-positive values (e.g. `[500, 500, 500, 500]`, NOT `[0, 500, …]`). Bad pattern throws synchronously inside `createChannel`/`createTriggerNotification`.
- Channel IDs versioned: `cue-clock-alarm-v3`, `cue-clock-notif-v3`. Android channels are immutable post-creation; v1/v2 IDs are explicitly deleted on first run.
- Trigger uses `AlarmManager.SET_EXACT_AND_ALLOW_WHILE_IDLE` (survives Doze).

**Four modal-mount paths** (every alarm fire reaches the modal regardless of OS state):

1. **Foreground tick** - countdown ticker at `alert:shouldFire` queues into `alertQueueRef`. **Match is exact-second** (`totalMinutes === alertMinutesBefore && seconds === 0`), NOT a `<= trigger` range check. Snooze reschedules at a non-aligned timestamp (e.g. snooze at 10:38:03 → fire at 10:39:03); a range check would refire instantly because `remaining ≤ alertMinutesBefore*60` already holds for the rest of the snooze window.
2. **Foreground Notifee delivery** - covers snoozed alarms whose non-minute-aligned fire times slip past path 1. `lib/alarmHandlers.ts` exposes a module-level `fgDeliveredQueue: { notifId, blockId }[]`; `onForegroundEvent` pushes on `EventType.DELIVERED` for `cue-clock-alarm-v3`. The 1-Hz ticker drains the queue and calls `setAlarmDismissData` directly (bypasses `alertQueueRef` because that drain is keyed on `targetBlocks` changes and a snoozed fire doesn't necessarily mutate the block). Cancellation of the OS heads-up goes through `pendingCancelRef` _after_ the modal mounts - NOT synchronously inside the handler (synchronous cancel breaks FSI activity launches; we tried). Bridge is a mutable array because `alarmHandlers.ts` registers at module load before React mounts, so it cannot capture a React setter.
3. **Cold start via FSI** - `notifee.getInitialNotification()` read after AsyncStorage hydration mounts modal with stored block context.
4. **Warm resume** - alarm fires while backgrounded; ticker records into `pendingBackgroundFiresRef` (`alert:bgFireRecorded`). On `AppState=active`, ref is drained (`appState:resume:drainBgFires`) → modal mounts. Defensive `fireDate === null` path (`appState:resume:fallbackQueueModal`) covers locked-screen case where the JS ticker was suspended.

**Fullscreen (On-Air) interaction.** RN `<Modal>` on Android is a separate Dialog window; when the host activity is in immersive mode (status-bar hidden by OnAirView's `<StatusBar hidden translucent>`), HyperOS/MIUI silently drops the Dialog on mount, so the AlarmDismissModal would never appear over OnAirView. The effect at `index.tsx:1198-1210` watches `alarmDismissData`: on transition to non-null while `fullScreen` is true, it captures the pre-alarm value into `fullScreenBeforeAlarmRef` and calls `setFullScreen(false)`. Both `handleAlarmDismiss` and `handleAlarmSnooze` consume the ref to restore fullscreen, so the operator drops back into On-Air automatically - including across repeated snooze cycles.

**Scheduling source of truth - `rescheduleInBackground` (`app/index.tsx`).** All CueEditModal save paths (add-new, edit-existing-with-alert, edit-existing-to-add-alert) MUST flow through this helper. It builds `tempBlock = { ...(block ?? createDefaultBlock(id)), ...patch, id }` and gates on the **merged** `tempBlock.alertMinutesBefore`, NOT `block.alertMinutesBefore`. Two regressions this guards against:

1. **Add-new**: `targetBlocksRef.current` doesn't contain the brand-new block yet (React state flush is async). A `find()` returns undefined → silent bail if the bail condition consults the ref.
2. **Edit-to-add-alert**: the pre-patch block has `alertMinutesBefore === null`. A bail keyed on the pre-patch value drops the schedule for cues gaining their first alert.

Symptom of either regression: cues appear configured in the UI and the JS-side `fallbackQueueModal` fires on resume, but `alarms:scheduleAlarm:perms` / `:ok` never log because Notifee was never invoked - so locked-screen FSI has nothing to elevate.

**Background heads-up vibration** (`lib/alarmHandlers.ts`). When the OS downgrades FSI to a plain heads-up (Android 14+ refuses to launch Activity when screen is on + another app focused - documented, not overridable), `onBackgroundEvent` watches for `EventType.DELIVERED` on the alarm channel and starts a 1.2s `AlarmVibrator.vibrateAsAlarm(600)` loop with a 60s cap. Loop self-cancels on `AppState=active`, `DISMISSED`, or `ACTION_PRESS`.

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

1. Build-time env var `EXPO_PUBLIC_DEBUG_LOGS=1` (only set by `android-internal.yml`, NEVER by `android-beta.yml` or `android-promote.yml`).
2. `dlog()` short-circuits to no-op when flag unset.
3. UI: `onTestAlarm`/`onShowDebugLog` props are `undefined` in release, hiding the Help-modal row entirely.

**Access on internal builds:** Help (?) → row below "About the Developer" → Test Alarm / Debug Log buttons.

Log at platform/permission boundaries. Never at 1s-tick hot loops.

---

## Onboarding Flow (Android, first launch)

Two-step wizard:

1. `AndroidBackgroundHelpModal` - bottom sheet (`ModalShell`) with 5 numbered step cards: (01) Disable activity pause, (02) Set battery to Unrestricted, (03) Allow exact alarms, (04) ⚠️ **Xiaomi/Redmi/POCO Autostart** (amber-bordered critical card), (05) Lock in Recents. Below the steps: an "Open directly" group of ghost rows that deep-link to App settings, Battery, Alarms & reminders, HyperOS Other Permissions, and MIUI Autostart. Internal builds additionally see a "Verify it works → Run test" card and a "View debug log" row. **Continue button is scroll-gated** - starts as a muted "Scroll down" label, flips to the accent "Got it" pill once the user reaches the bottom (16px slack). `onLayout` auto-unlocks when content fits without scrolling.
2. `AnalyticsConsentModal` - non-dismissable opt-in. Opens automatically when step 1 closes IF `analyticsEnabled === null`.

The native notification-permission dialog and the "Allow Exact Alarms" Alert are deliberately suppressed on first launch (in `app/index.tsx` we only call `getPermissionsAsync`, never `requestPermissionsAsync`). The wizard's deep-links cover the same ground without fragmenting the UX.

iOS/web skip step 1.

---

## Expo Config Plugin

`plugins/withFullScreenAlarm.js` - adds `android:showWhenLocked="true"` and `android:turnScreenOn="true"` to MainActivity. Android-only, no-op elsewhere.

---

## CI/CD

Three-track release flow. **Closed Testing (Alpha) is retired** — close it in Play Console manually.

| Trigger                                        | Workflow               | Play Track            |
| ---------------------------------------------- | ---------------------- | --------------------- |
| Push to `master`                               | `android-internal.yml` | Internal Testing      |
| Publish a GH **pre-release** (`vX.Y.Z-beta.N`) | `android-beta.yml`     | Open Testing (Beta)   |
| Flip pre-release → full release (`vX.Y.Z`)     | `android-promote.yml`  | Production (promoted) |
| Flip pre-release → full release (`vX.Y.Z`)     | `web-deploy.yml`       | Web app (Coolify)     |

Build workflows (internal, beta): Ubuntu 24.04, JDK 17, Node 22, Android SDK 35. Steps: `npm ci` → `expo prebuild --platform android --clean` → `gradlew bundleRelease` → upload via Play service account.

**ABIs are ARM-only.** All three build workflows pass `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` — x86/x86_64 are deliberately excluded. Every real Android phone is ARM; x86 environments (emulators/ChromeOS) run the ARM split via their translation layer. Dropping x86/x86_64 just shrinks the AAB. Do NOT re-add them.

**`useLegacyPackaging` MUST stay `true`** (set via `expo-build-properties` in `app.json` → writes `expo.useLegacyPackaging=true` to `gradle.properties`). This forces `android:extractNativeLibs="true"`, so the OS extracts native `.so` libs to the app's private `lib/` dir at install. With `false` (the modern Expo default), libs stay uncompressed inside the APK and load directly via SoLoader's `DirectApkSoSource` — **Android 11 and below have a buggy direct-from-APK path for transitive deps like `libc++_shared.so`**, which fatally crashed RN's New Architecture at `MainApplication.onCreate` (`SoLoaderDSONotFoundError`, Crashlytics — 100% Android 11, real ARM devices). Android 12+ is unaffected, but do NOT flip this back.

Promote workflow: no build. Calls Google Play Developer API directly (`.github/scripts/promote-to-production.js`, uses `googleapis`) to copy the most recent matching beta AAB to the production track — **byte-identical** to what beta testers validated.

**No manual `app.json` version bumps.** `versionName` is derived from git tags by `app/scripts/derive-internal-version.js` (internal track) and from the release tag itself by `app/scripts/prepare-android-release.js` (beta + production). The `expo.version` field in `app.json` is rewritten by CI before every build; the value committed to git only matters as a bootstrap fallback if zero `v*` tags exist.

**Web app deploy.** The Coolify-hosted web app is the Expo web export of `app/` (HelpModal's footer reads `Constants.expoConfig.version`). On `release: released` (full releases only), `web-deploy.yml` checks out the released tag and force-updates a CI-owned `release` branch to that exact commit. Coolify tracks the `release` branch (not `master`), so its existing git webhook auto-deploys the tagged tree — the web app deploys the exact release commit, never master HEAD. Coolify's build command must be `npm run build:web:deploy`, which runs `app/scripts/derive-web-version.js` first — that fetches the latest full GitHub release and stamps it into `app.json` `expo.version`, so the web footer matches mobile production. No Coolify API token/secrets needed. Setup steps are in the `web-deploy.yml` header.

### Release lifecycle

Tags are the source of truth. Two shapes only:

- `vX.Y.Z-beta.N` (`v0.1.0-beta.1`, `v0.1.0-beta.2`, …) — GitHub **pre-release**. Triggers `android-beta.yml`, builds a signed AAB, uploads to Open Testing with `versionName = X.Y.Z-beta.N`. Beta testers see the suffix and know which beta they're on.
- `vX.Y.Z` (`v0.1.0`) — GitHub **full release**. Triggers `android-promote.yml`. Picks the highest-versionCode completed beta release whose name matches `X.Y.Z-beta.*` and promotes that exact AAB to Production with release name `X.Y.Z`. No rebuild. The AAB's internal `versionName` stays `X.Y.Z-beta.N` for audit/crash-report traceability — `HelpModal` strips the `-beta.N` suffix at display time so the in-app footer reads `X.Y.Z` for production users (Play Store release name + Help footer both show clean semver).

Typical cycle:

```
master push       → internal     (versionName auto-derived from latest tag, versionCode = unix timestamp)
master push       → internal
tag v0.1.0-beta.1 → open testing (versionName=0.1.0-beta.1, fresh build)
master push       → internal
tag v0.1.0-beta.2 → open testing (versionName=0.1.0-beta.2, fresh build)
flip v0.1.0       → production   (promotes the beta.2 AAB, release name = "0.1.0")
```

Production users only ever see clean `0.1.0`, `0.1.1`, etc. — the intermediate beta cadence is invisible. **Author the release body for `vX.Y.Z` to summarise the whole cycle since the previous production release**, not just the delta from the last beta — production users skip every intermediate step.

### Guards baked into the workflows

- `android-beta.yml` rejects any tag not matching `vX.Y.Z-beta.N`.
- `android-beta.yml` checks out the tag SHA (not master HEAD) so the build is reproducible from the release.
- Concurrency: `group: android-beta` (no tag suffix) — serializes all beta builds so a fast second pre-release can't overtake a slower first one.
- `android-promote.yml` rejects any tag not matching `vX.Y.Z` (bare semver). Refuses to promote beta-shaped tags accidentally flipped to full release.
- Promotion script filters beta releases to `status === "completed"` (skips halted/rejected builds) and matches `versionName` family (`<target>-beta.*`) so an in-flight `v0.2.0-beta` cycle can't be misrouted as `v0.1.0`.
- Promotion is idempotent: if the picked versionCode is already on production, the script exits cleanly. Safe to re-trigger via prerelease-flag toggling.

### Manual prerequisites (one-time, can't be done in CI)

1. **Play Console — service account permissions.** The identity in `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` needs Release manager (or equivalent) with access to **internal, beta, and production** tracks. The current alpha-era account may not have production yet.
2. **Play Console — first production push gates.** Before the first promotion succeeds, fill: target audience declaration, data safety form, content rating, store listing graphics. The promote workflow will fail loudly with a Play API error until these are done.
3. **Close the alpha track.** Once nothing's shipping there, archive in Play Console.

**Workflow env var:** `EXPO_PUBLIC_DEBUG_LOGS=1` set ONLY in `android-internal.yml`.

Required secrets: `EXPO_PUBLIC_CLARITY_KEY`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `GOOGLE_SERVICES_JSON_BASE64`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `EAS_PROJECT_ID`, `EAS_OWNER`. Package: `com.yanukadeneth99.cueclock`.

---

## Local On-Device Testing (MacBook M1 → Redmi Note 12 / Android 15 / HyperOS V816)

This device is the worst-case calibration target - almost every gotcha was found here. JDK 17 (Temurin) and Android SDK already installed; we pin `JAVA_HOME` per-command rather than changing the global.

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

### Cold reload (preferred - use this for every JS change)

**Never trust Metro's warm cache.** A stale delta-bundle has silently shipped old code more than once. The one-shot script kills Metro, restarts it with `--clear`, reverse-forwards the port, and relaunches the app:

```bash
./app/scripts/cold-reload.sh           # keep app data (cues, settings, consent flag)
./app/scripts/cold-reload.sh --wipe    # also wipe app data via `pm clear` - re-fires onboarding
```

Metro logs stream to `/tmp/cueclock-metro.log` (`tail -f` it). Stop Metro later with `lsof -ti :8081 | xargs kill -9`.

`CI=1` (set inside the script) avoids interactive prompts. `EXPO_PUBLIC_DEBUG_LOGS=1` enables the in-app log button locally.

If you ever need the raw recipe (e.g. on a different OS or shell), the script's body is the same set of `adb` + `npx expo start` invocations the previous "Metro + JS hot reload" entry used.

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

- **`INSTALL_FAILED_VERSION_DOWNGRADE`** - Play Store version installed. `adb uninstall com.yanukadeneth99.cueclock` (wipes state).
- **HyperOS Second Space leftover** - Play refuses install citing "incompatible version" even after normal uninstall. Check `adb shell pm list users`; if `10:security space` exists, `adb shell pm uninstall --user 10 com.yanukadeneth99.cueclock`.
- **Replug drops tunnel** - every USB unplug breaks `adb reverse`. Re-run after every reconnect.
- **Stale bundle with `CI=1`** - Metro doesn't watch files. Kill Metro by port and restart with `--clear`.
- **Notifee `app.notifee:core:+` not found** - `expo prebuild` regenerates `android/build.gradle` without Notifee's local Maven entry. Add to `allprojects.repositories`:

  ```gradle
  maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }
  ```

  (TODO: convert to config plugin for durability.)

- **HyperOS settings reset on reinstall** - every fresh APK install wipes per-app HyperOS toggles. Re-enable Other Permissions + Autostart + Battery unrestricted, or background/locked FSI silently fails.

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
- **Error handling.** Empty/commented `catch` for production silence. No `console.log` - use `dlog` at boundaries.
- **Naming.** `camelCase` vars/functions, `UPPER_SNAKE_CASE` constants, `PascalCase` types.
- **Imports.** Absolute aliases (`@/components/`, `@/constants/`).
- **`(window as any).Notification` and `onHoverIn as any`** are intentional RN-Web escape hatches - leave them.

### Git

- **No `Co-Authored-By: Claude`/`Anthropic` trailers in commits.** Ever.
- **Confirm before committing to `master`/`main`/`production`.**

---

## License

AGPL-3.0. Commercial: <hello@yashura.io>. Security reports: see `SECURITY.md`.
