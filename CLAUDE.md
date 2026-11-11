# Cue Clock - Project Rules and Guide

> ⚠ **Public repo.** No secrets, internal URLs, unreleased names, or partner info in commits.

**Cue Clock** is a minimal, distraction-free clock app for broadcast professionals monitoring multiple timezones and countdown timers at once. The project is finished: it only gets crash fixes and security updates.

## Non-negotiables

These cannot be overridden even by the author/owner:

- Single-device by design. No cross-device sync, user accounts (login), or backend that stores user timers.
- License is AGPL-3.0. Keep license headers intact. Do not add dependencies with incompatible licenses.
- Offline-first: the app must work with no network connection.
- Keep it minimal, fast and intuitive.
- Time sync must be near perfect with least latency, since the time is critical.
- Timers must be the most visible item on screen. Expect users to view it from a distance.
- The 3 second sounds must stay in sync with the countdown at all times.
- Real people use this app. No fix or change may break a running feature.
- Code comments must be short and simple enough for a non-technical person to understand.
- Absolutely NO semantic line breaks.

## Layout

- **`app/`** — the Cue Clock app: Expo (SDK 55) / React Native for Android, iOS and web from one codebase. The web build is a Metro static export. Versions live in `app/package.json` and `app/app.json`. Package: `com.yanukadeneth99.cueclock`.
- **`website/`** — the marketing site (Next.js 16, Tailwind 4, GSAP) at cueclock.app. Colours mirror `app/constants/colors.ts`. It does not import from `app/`.
- **`tests/maestro/`** — Maestro flows run on a real Android phone. See its README.
- **`docs/`** — `wiki.md` is the user guide, copied to the GitHub Wiki by `wiki-sync.yml`. `ai-evals.md` is history of a retired experiment.
- **`.github/`** — workflows, plus `scripts/` for crash-to-issue and the Play promote step (tests in `scripts/lib/*.test.js`).

Inside `app/`:

- `app/index.tsx` — HomeScreen. ALL app state lives here and persists to AsyncStorage.
- `lib/` — `alarms.ts` (Notifee wrapper), `alarmHandlers.ts` (background/foreground events and background vibration loop), `time.ts` (`computeCountdown`), `urgency.ts` (`urgencyFactor`), `useNow.ts` (1s ticker aligned to the wall clock), `debugLog.ts`.
- `modules/expo-alarm-vibrator/` — local Kotlin module for ALARM-class vibration.
- `plugins/withFullScreenAlarm.js` — adds `showWhenLocked` + `turnScreenOn` to MainActivity (Android only).

## Commands

Run in `app/`: `npm ci`, `npx expo start`, `npm run lint`, `npx tsc --noEmit`. Run in `website/`: `npm ci`, `npm run dev`, `npm run lint`, `npm run build`. Run at the repo root: `node --test .github/scripts/lib/*.test.js`. See [DEVELOPMENT.md](./DEVELOPMENT.md) for more.

## Conventions

- **TypeScript strict.** `T[]` not `Array<T>`. `Pressable` not `Button`.
- **Styling.** Inline `style={...}` only. Colors from `app/constants/colors.ts`, typography from `app/constants/typography.ts`, safe area via `useSafeAreaInsets()` (never hardcode insets).
- **Components.** Function declarations for default exports; handlers in `useCallback`; `React.memo` on list items.
- **Errors.** Empty/commented `catch` for production silence. No `console.log`; use `dlog` at boundaries, never in 1s-tick hot loops.
- **Naming.** `camelCase` vars/functions, `UPPER_SNAKE_CASE` constants, `PascalCase` types. Absolute imports (`@/components/`, `@/constants/`).
- `(window as any).Notification` and `onHoverIn as any` are intentional RN-Web escape hatches. Leave them.
- **Git.** No `Co-Authored-By: Claude`/`Anthropic` trailers, ever. Confirm before committing to `master`/`main`/`production`.

## Design System

Surface stack: `page` (#0a0b0e) → `background` (#1a1d23) → `surface` (#252830). Blue `accent` (#60a5fa) for CTA + brand. Amber `countdown` (#fbbf24) ONLY for time-urgency and alarm state. Red `danger` (#ef4444) ONLY for <1m critical and destructive actions. Zone dots: `zone1` green / `zone2` red.

Inter for UI, Space Mono for all numerics, always with `fontVariantNumeric: 'tabular-nums'` (already in the `text.*` presets).

**Urgency scaling.** `PrimaryCard` and the `OnAirView` hero card scale font size, padding and halo from `urgencyFactor(total)`: 0 when calm (>5 min), 1 in the last minute, linear between 300s and 60s. Border/background swap discretely at warn/crit; size growth is continuous.

## Architecture

**Render branches** in `index.tsx` (web and native share the same tree): `!fullScreen` → `Header` + `ClockRail` + `PrimaryCard`/`QueuedRow`/`PassedStrip` + `CueEditModal`/`ZonePickerModal`; `fullScreen` → `OnAirView`. A third `return` at the end of the file (old `ClockPicker`/`TargetBlock`/`AlertModal`) is unreachable dead code. Do not build against it.

**State.** Persisted keys: `zone1`/`zone2`, `targetBlocks`, `is24Hour`, `alertMode` (`notification`|`alarm`), `showSeconds`, `soundAlerts`, `keepOn`, `autoMinimizePassed` (default true), `finalBeep` (default true, native only), `analyticsEnabled` (null = unasked), `androidBackgroundHelpSeen`. **Reset keeps `analyticsEnabled`**: `doReset` uses `multiRemove` on specific keys, NOT `clear`.

**Countdown.** `setInterval(1s)`. Per block: target time in zone, +1 day if past, minus deduction, formatted `HH:MM:SS`. Skip React updates if the string did not change.

**Fire-and-forget async.** `handleTargetConfirm`/`handleAlertConfirm`/`removeBlock` update state first, then reschedule notifications in a background IIFE so the UI stays under 16ms.

**Passed cues (stateless, zone1-anchored).** `computeCountdown` rolls past zero to ~86400, so "expired" is not a native state. `passedAt` is a `useMemo` from `now` + `targetBlocks` + zones, recomputed every tick. NO edge detection, NO TTL, NO refs. Per cue: `mostRecentFireMs = nowMs - (86400 - cd.total) * 1000`, included if inside `[zone1Midnight, now]`. Passed cues show as `PassedStrip`s above the primary card and never reschedule alarms. Manual × goes into `dismissedFireMs` keyed by fire time. **Do NOT bring back the old edge-detected design** (`lastTotalsRef` + 5-min TTL): it missed rollovers whenever the JS ticker was suspended. The auto-minimize toggle only gates rendering, by swapping `passedAt` with a frozen `EMPTY_PASSED`.

**Sorting.** Active blocks are sorted by `computeCountdown(...).total` ascending each tick. `OnAirView` does not sort or filter: the caller must pass only non-passed cues (`passedAt[b.id] == null`) sorted the same way.

**Final-3s beep (`finalBeep`).** Native-only sound for the PRIMARY cue: 130ms 880Hz tick at T-3/T-2/T-1, then a 420ms 1320Hz "go" at zero. Invariants:

1. A **2-player pool** (`beepPlayerA`/`beepPlayerB`) alternated per tick is REQUIRED. Back-to-back `seekTo+play` on one player drops a beep.
2. Scheduling is **predictive**: detection fires one second early and `setTimeout(1000 - BEEP_LEAD_MS)` plays the beep `BEEP_LEAD_MS` (300ms) before the second boundary to cover output latency. `BEEP_LEAD_MS` is the ONLY sync knob.
3. **Pre-warm `SETTLE_MS = 500`** must be longer than the 130ms clip, or the first cue's T-3/T-2 are dropped.

Pending timeouts live in `pendingBeepTimersRef`, cleared on cue removal, primary swap, toggle-off and unmount. The "go" tone is gated by `goFiredForRef` (1h eviction) so the +24h rollover does not refire it. Beep logs need `EXPO_PUBLIC_DEBUG_LOGS=1`.

## Alerts

Two modes, Android first.

**Alarm mode.** A full-screen alarm that wakes the device over the lock screen. Audio (`expo-audio` looping `alarm.mp3`) and vibration (`expo-alarm-vibrator`) are owned by `AlarmDismissModal`, because Android mutes channel sound once the full-screen intent launches an Activity. 60s safety cap. Notifee rules:

- `fullScreenAction.launchActivity` / `pressAction.launchActivity` MUST be the full class name `com.yanukadeneth99.cueclock.MainActivity`. HyperOS and Android 14+ refuse `"default"`.
- `vibrationPattern` must be even-length with strictly positive values (`[500,500,500,500]`, NOT `[0,500,…]`). A bad pattern throws in `createChannel`/`createTriggerNotification`.
- Channel IDs are versioned (`cue-clock-alarm-v3`, `cue-clock-notif-v3`) and cannot change once created. v1/v2 are deleted on first run.
- Triggers use `AlarmManager.SET_EXACT_AND_ALLOW_WHILE_IDLE` so they survive Doze.

**Four ways an alert reaches the modal:** (1) foreground tick, exact-second match (`totalMinutes === alertMinutesBefore && seconds === 0`), NOT a `<=` check, because snooze fires at odd times; (2) foreground Notifee delivery via `fgDeliveredQueue` drained by the ticker, with the OS heads-up cancelled via `pendingCancelRef` AFTER mount (cancelling first breaks full-screen launches); (3) cold start via `notifee.getInitialNotification()`; (4) warm resume via `pendingBackgroundFiresRef` drained on `AppState=active`.

**Fullscreen.** HyperOS drops RN `<Modal>` while the activity is immersive. So on alarm while fullscreen, the effect saves `fullScreenBeforeAlarmRef` and calls `setFullScreen(false)`; dismiss/snooze restore it.

**Scheduling.** ALL CueEditModal save paths (add, edit with alert, edit to add alert) MUST go through `rescheduleInBackground`, which checks the merged `tempBlock.alertMinutesBefore`, NOT the pre-patch `block.alertMinutesBefore`. Otherwise add-new and edit-to-add-alert silently skip the schedule.

**Background vibration.** When Android 14+ downgrades the full-screen alert to a heads-up, `onBackgroundEvent` starts a 1.2s `AlarmVibrator.vibrateAsAlarm(600)` loop (60s cap) that stops on `AppState=active`/`DISMISSED`/`ACTION_PRESS`.

**ALARM-class vibration.** `modules/expo-alarm-vibrator` calls `Vibrator.vibrate(VibrationEffect, AudioAttributes.USAGE_ALARM)`. Plain `Vibration.vibrate(ms)` is `mUsage=TOUCH` and Xiaomi/HyperOS rejects it (`IGNORED_FOR_SETTINGS`) when "Vibrate on Tap" is off. API: `vibrateAsAlarm(durationMs)`, `cancel()`. In logcat, `mUsage=ALARM ... FINISHED` is success; `mUsage=TOUCH` means JS still calls `Vibration.vibrate()` somewhere.

**Snooze.** `MAX_SNOOZES = Infinity`; `snoozeCount` resets to 0 when a new alert is set.

**Notification mode** (fallback): heads-up only, channel `cue-clock-notif-v3`, same exact-alarm trigger. Web uses the Web Notifications API, then `window.alert`; iOS uses `expo-notifications`.

**Permissions:** `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`. Runtime checks `canScheduleExactAlarms()` / `canUseFullScreenIntent()` deep-link to settings if missing.

## Debug Log & Onboarding

**Debug log** (`lib/debugLog.ts`): 200-entry ring buffer. It is off in release builds: `EXPO_PUBLIC_DEBUG_LOGS=1` is set ONLY by `android-internal.yml`, `dlog()` does nothing without it, and the Help-modal row is hidden when `onTestAlarm`/`onShowDebugLog` are undefined.

**Onboarding (Android, first launch):** (1) `AndroidBackgroundHelpModal` (5 step cards, scroll-gated Continue), then (2) `AnalyticsConsentModal` (cannot be dismissed, opens when `analyticsEnabled === null`). The notification-permission dialog and exact-alarm Alert are deliberately skipped on first launch (only `getPermissionsAsync`, never `requestPermissionsAsync`); the wizard's links cover them. iOS and web skip step 1.

## Releases

Tags are the source of truth. **No manual `app.json` version bumps.** CI derives `versionName` from git tags and rewrites `expo.version` before each build. Release notes are written by hand.

| Trigger | Workflow | Result |
| --- | --- | --- |
| Push to `master` | `android-internal.yml` | Play Internal Testing |
| Publish pre-release `vX.Y.Z-beta.N` | `android-beta.yml` | Play Open Testing |
| Publish full release `vX.Y.Z` | `android-promote.yml` | Promote the beta build to Production |
| Publish full release `vX.Y.Z` | `web-deploy.yml` | Web app (Coolify) |

Build workflows use Ubuntu 24.04, JDK 17, Node 22, SDK 35: `npm ci` → `expo prebuild --clean` → `gradlew bundleRelease` → upload. Promote does NOT rebuild: it copies the highest-versionCode completed `X.Y.Z-beta.*` AAB unchanged to Production through the Play Developer API (safe to re-run). The AAB keeps its `-beta.N` versionName; `HelpModal` strips it. `web-deploy.yml` force-updates a CI-owned `release` branch, which Coolify tracks. A `vX.Y.Z` release body should summarise everything since the previous production release.

**Hard invariants (do NOT change):**

- **Release workflows MUST trigger on `published`, never `prereleased`.** GitHub does not fire `prereleased` when a pre-release is published from a draft. Check `github.event.release.prerelease` in the job's `if:`. (`released` is safe, which is why `android-promote.yml` and `web-deploy.yml` use it.)
- **ABIs are ARM-only** (`arm64-v8a,armeabi-v7a`). Do NOT re-add x86/x86_64.
- **`useLegacyPackaging` MUST stay `true`** (via `expo-build-properties` in `app.json`). With `false`, Android 11 and below crash at startup on `libc++_shared.so`.

Secrets: `EXPO_PUBLIC_CLARITY_KEY`, `ANDROID_KEYSTORE_BASE64`/`_PASSWORD`, `ANDROID_KEY_ALIAS`/`_PASSWORD`, `GOOGLE_SERVICES_JSON_BASE64`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `EAS_PROJECT_ID`, `EAS_OWNER`.
