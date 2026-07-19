# Cue Clock - Project Rules and Guide

> ⚠ **Public repo.** No secrets, internal URLs, unreleased names, or partner info in commits.

**Cue Clock** is a minimal, distraction-free clock app for broadcast professionals monitoring multiple timezones and countdown timers simultaneously.

## Non-negotiables

The following list cannot be overriden even by the author/owner:

- Single-device by design. Do NOT add cross-device sync, user accounts (login), or a backend that stores user timers.
- License is AGPL-3.0. Keep license headers intact. Do not add dependencies with incompatible licenses.
- Offline-first: the application must work with no network connection.
- The application MUST stay minimal, fast and intuitive.
- The time syncs must be near perfect with least latency (since the time is critical).
- Timers must be the most visible item in the application. Expect the user to view this application screen from a distance.
- 3 Second Sounds must sync perfectly with the countdown at all times.
- The application is being used by real people. Ensure that no new fixes or changes negatively effects other running features.
- All code comments and comments must be short and simple enough for a non-technical person to understand.
- Absolutely NO semantic line breaks.
- Any workflow file that uses Claude must have the `claude-` prefix.

---

## Repository Architecture

Three top-level products live in this one repo. Read this map first to know which folder a change belongs in.

- **`app/`** — the Cue Clock application itself: an Expo (SDK 55) / React Native project that ships to **Android, iOS, and web from one codebase** (`app.json` declares all three platforms; the web build is a Metro static export, `web.output: "static"`). This is THE product — everything in `## Stack & Layout`, `## Design System`, `## Architecture`, and `## Alert System` below describes this folder unless stated otherwise. Web and native render the SAME modern component tree (see Render branches); the web build only diverges where a platform feature forces it (header `+` instead of the pinned-bottom add button, inline `TimeStepper` digit fields instead of the OS time picker, no alarm/FSI, no Android onboarding wizard).
- **`website/`** — the public marketing / branding site for Cue Clock (the landing page, not the app): a **Next.js 16** app (React 19, Tailwind 4, GSAP) with the App Router under `website/src/app/` (`page.tsx` landing, `privacy/`, `robots.ts`, `sitemap.ts`, assets in `public/`). Its design tokens mirror `app/constants/colors.ts` via `@theme` in `globals.css` so brand colours stay in sync. Deployed by `web-deploy.yml` → Coolify on full release. It does NOT import from `app/`.
- **`tests/`** — automated tests for the app. Currently just `tests/ai/`, the Gemini-driven AI E2E harness that exercises the REAL running app: `tests/ai/android/` (TypeScript, LangChain.js + LangGraph) drives `agent-device` against a physical Android phone, and `tests/ai/web/` (Python, `browser-use` + Playwright) drives Chromium against the web build at `localhost:8081`. Scenarios are plain markdown in `tests/ai/scenarios/{android,web}/` (one shared `Setup / Steps / Expected / Visual / Verdict` format, parsed by both runners); `tests/ai/scripts/test-all.sh` is the orchestrator. Gemini-only, key in gitignored `tests/ai/.env`.

---

## Stack & Layout

Stack and versions live in `app/package.json` and `app/app.json` — read those rather than trusting a copy here. Styling is inline `style={...}` only (no StyleSheet libs); colors via `app/constants/colors.ts`, typography via `app/constants/typography.ts`, safe area via `useSafeAreaInsets()` (never hardcode insets). Package: `com.yanukadeneth99.cueclock`.

- `app/app/index.tsx` — HomeScreen; ALL app state lives here and persists to AsyncStorage. Three render branches (see below).
- `app/lib/` — `alarms.ts` (Notifee wrapper), `alarmHandlers.ts` (bg/fg event dispatcher + bg vibration loop), `time.ts` (`computeCountdown` etc.), `urgency.ts` (`urgencyFactor`), `useNow.ts` (wall-clock-aligned 1s ticker).
- `app/modules/expo-alarm-vibrator/` — local native Kotlin module for ALARM-class vibration.
- `app/plugins/withFullScreenAlarm.js` — adds `showWhenLocked` + `turnScreenOn` to MainActivity (Android-only, no-op elsewhere).

---

## Design System

Surface stack: `page` (#0a0b0e) → `background` (#1a1d23, default screen bg) → `surface` (#252830, cards/sheets). Single blue `accent` (#60a5fa) for CTA + brand. Amber `countdown` (#fbbf24) is reserved for time-urgency + alarm state ONLY. Red `danger` (#ef4444) is reserved for <1m critical + destructive actions ONLY. Zone dots: `zone1` green / `zone2` red.

**Typography.** Inter for UI, Space Mono for all numerics. Always pair clock/countdown displays with `fontVariantNumeric: 'tabular-nums'` (wired into the `text.*` presets) so digit changes don't shift layout.

**Continuous urgency scaling.** `PrimaryCard` and the `OnAirView` hero card interpolate font size, padding, and halo radius from `urgencyFactor(total)` — 0 when calm (>5 min), 1 in the last minute, linear across the 300s→60s window. Border/background swap discretely at warn/crit thresholds; size growth is continuous (`app/lib/urgency.ts`).

**Render branches** in `index.tsx` (web and native share the SAME tree now): `!fullScreen` → the unified home (`Header` + `ClockRail` + `PrimaryCard`/`QueuedRow`/`PassedStrip` + `CueEditModal`/`ZonePickerModal`), used by both native and web; `fullScreen` → `OnAirView` (cross-platform RN primitives, reachable on web via the header full-screen button too). A THIRD `return` at the tail of the file still renders the old `ClockPicker`/`TargetBlock`/`AlertModal` path, but it is now **unreachable dead code** kept only until a follow-up cleanup commit — do NOT build against it or assume web hits it.

---

## Architecture

**State.** All state lives on `HomeScreen` and persists via `multiSet`/`multiGet`, rehydrated on mount. Persisted keys include `zone1`/`zone2`, `targetBlocks`, `is24Hour`, `alertMode` (`notification`|`alarm`), `showSeconds`, `soundAlerts`, `keepOn`, `autoMinimizePassed` (default true), `finalBeep` (default true, native-only), `analyticsEnabled` (3-state: null = unasked), `androidBackgroundHelpSeen`. **Reset preserves `analyticsEnabled`** — `doReset` uses `multiRemove` on specific keys, NOT `clear`.

**Countdown.** `setInterval(1s)`. Per-block: target time in zone, +1 day if past, minus deduction, formatted `HH:MM:SS`; skip React reconciliation if the formatted string didn't change.

**Fire-and-forget async.** `handleTargetConfirm`/`handleAlertConfirm`/`removeBlock` update state synchronously, then reschedule notifications in a background IIFE so UI stays <16ms.

**Passed-cue rotation (stateless, zone1-anchored).** `computeCountdown` rolls past zero to ~86400, so "expired" isn't a native state. `passedAt` is a `useMemo` derived from `now` + `targetBlocks` + zones every tick — NO edge detection, NO TTL, NO refs. Per cue: `mostRecentFireMs = nowMs - (86400 - cd.total) * 1000`, included iff inside `[zone1Midnight, now]`. The render path lifts those ids into `PassedStrip`s above the primary card (auto-promoting the next cue); strips never reschedule alarms. Day boundary is zone1, so all passed cues un-minimize together at zone1 midnight. Manual × goes into `dismissedFireMs` keyed by fire timestamp, so next-day re-fire re-shows the strip automatically. **Do NOT reintroduce the old edge-detected design** (`lastTotalsRef` + 5-min TTL) — it missed rollovers whenever the JS ticker was suspended.

**Auto-minimize toggle gates RENDER only** — it swaps the source between live `passedAt` and a frozen `EMPTY_PASSED` sentinel. Because `passedAt` is stateless, flipping off then on hours later still minimizes correctly.

**Auto-sort by remaining time.** Render path sorts active blocks by `computeCountdown(...).total` ascending each tick; zones aren't in the sort key (`total` is already real wall-clock seconds-from-now). Persisted order no longer drives display.

**`OnAirView` is a pure presenter** — it does NOT sort/filter. The fullscreen caller MUST pre-filter passed cues (`passedAt[b.id] == null`) and sort ascending by `computeCountdown` total before passing, identical to `activeBlocks`. Passing raw `targetBlocks` causes wrong ordering.

**Final-3s beep (`finalBeep`).** Native-only SFX for the PRIMARY cue: 130ms 880Hz tick at T-3/T-2/T-1, then a 420ms 1320Hz "go" at zero. Three non-obvious invariants: (1) a **2-player pool** (`beepPlayerA`/`beepPlayerB`) alternated per tick is REQUIRED — back-to-back `seekTo+play` 1s apart on one instance races and drops a beep; (2) scheduling is **predictive** — detection fires one second early and `setTimeout(1000 - BEEP_LEAD_MS)` lands the beep ~`BEEP_LEAD_MS` (300ms) before the second boundary to compensate for dispatch+output latency (`BEEP_LEAD_MS` is the ONLY A/V-sync knob); (3) **pre-warm `SETTLE_MS = 500`** must exceed the 130ms clip length, else the silent prime pauses mid-playback and the first cue's T-3/T-2 are dropped. Pending timeouts are tracked in `pendingBeepTimersRef`, cleared on cue removal / primary swap / toggle-off / unmount. The "go" tone is gated by `goFiredForRef` (1h eviction) so the +24h rollover doesn't refire it. Beep diagnostics are gated by `EXPO_PUBLIC_DEBUG_LOGS=1`.

---

## Alert System

Dual-mode, Android-first.

**Alarm Mode (primary).** Full-screen UX that wakes the device over the lock screen. Audio (`expo-audio` looping `alarm.mp3`) and vibration (`expo-alarm-vibrator`) are owned by `AlarmDismissModal` in-activity — Android suppresses channel sound once FSI launches an Activity, so channel config is fallback only. **60s safety cap.** Notifee quirks that matter:

- `fullScreenAction.launchActivity` / `pressAction.launchActivity` MUST be the fully-qualified class name (`com.yanukadeneth99.cueclock.MainActivity`). HyperOS/Android 14+ silently refuses `"default"`.
- `vibrationPattern` must be even-length, strictly-positive values (`[500,500,500,500]`, NOT `[0,500,…]`) — a bad pattern throws synchronously in `createChannel`/`createTriggerNotification`.
- Channel IDs are versioned (`cue-clock-alarm-v3`, `cue-clock-notif-v3`) and immutable post-creation; v1/v2 are deleted on first run.
- Trigger uses `AlarmManager.SET_EXACT_AND_ALLOW_WHILE_IDLE` (survives Doze).

**Four modal-mount paths** (every fire reaches the modal): (1) foreground tick — exact-second match (`totalMinutes === alertMinutesBefore && seconds === 0`), NOT a `<=` range check (snooze fires at non-aligned times); (2) foreground Notifee delivery — `alarmHandlers.ts` `fgDeliveredQueue` drained by the ticker, OS heads-up cancelled via `pendingCancelRef` AFTER mount (synchronous cancel breaks FSI launches); (3) cold start via `notifee.getInitialNotification()`; (4) warm resume — `pendingBackgroundFiresRef` drained on `AppState=active`.

**Fullscreen interaction.** RN `<Modal>` is silently dropped by HyperOS while the host activity is in immersive mode, so on alarm-while-fullscreen the effect captures `fullScreenBeforeAlarmRef` and calls `setFullScreen(false)`; dismiss/snooze restore it (works across repeated snoozes).

**Scheduling source of truth — `rescheduleInBackground`.** ALL CueEditModal save paths (add-new, edit-with-alert, edit-to-add-alert) MUST flow through it. It gates on the **merged** `tempBlock.alertMinutesBefore`, NOT the pre-patch `block.alertMinutesBefore` — otherwise add-new (block not yet in `targetBlocksRef`) and edit-to-add-alert (pre-patch value is null) silently drop the schedule.

**Background heads-up vibration.** When the OS downgrades FSI to a plain heads-up (Android 14+ refuses to launch an Activity when screen is on + another app focused), `onBackgroundEvent` starts a 1.2s `AlarmVibrator.vibrateAsAlarm(600)` loop (60s cap), self-cancelling on `AppState=active`/`DISMISSED`/`ACTION_PRESS`.

**Snooze.** `MAX_SNOOZES = Infinity`; `snoozeCount` resets to 0 when a new alert is configured.

**Required permissions:** `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`. Runtime checks `canScheduleExactAlarms()` / `canUseFullScreenIntent()` deep-link to settings if missing.

**Notification mode** (fallback): heads-up only, channel `cue-clock-notif-v3`, same exact-alarm trigger. **Web/iOS:** Web Notifications API → `window.alert`; iOS uses `expo-notifications`.

---

## ALARM-class Vibration (`modules/expo-alarm-vibrator`)

Dispatches `Vibrator.vibrate(VibrationEffect, AudioAttributes.USAGE_ALARM)`. Without it, RN's `Vibration.vibrate(ms)` is classified `mUsage=TOUCH` and rejected by Xiaomi/HyperOS with `IGNORED_FOR_SETTINGS` when "Vibrate on Tap" is off. API: `vibrateAsAlarm(durationMs)`, `cancel()`. Logcat success = `mUsage=ALARM ... FINISHED`; `mUsage=TOUCH ... IGNORED_FOR_SETTINGS` means JS still calls `Vibration.vibrate()` somewhere. Registered via Expo autolinking; survives `expo prebuild --clean`.

---

## Debug Log & Onboarding

**Debug log** (`lib/debugLog.ts`): 200-entry ring buffer, gated three ways for release safety — build-time `EXPO_PUBLIC_DEBUG_LOGS=1` (set ONLY by `android-internal.yml`), `dlog()` no-ops when unset, and the Help-modal row is hidden when `onTestAlarm`/`onShowDebugLog` are undefined (release). Log at platform/permission boundaries, never in 1s-tick hot loops.

**Onboarding (Android, first launch):** two-step wizard — (1) `AndroidBackgroundHelpModal` (5 step cards incl. Xiaomi/Redmi/POCO Autostart; scroll-gated Continue), then (2) `AnalyticsConsentModal` (non-dismissable, opens iff `analyticsEnabled === null`). The native notification-permission dialog and exact-alarm Alert are deliberately suppressed on first launch (we only call `getPermissionsAsync`, never `requestPermissionsAsync`); the wizard's deep-links cover the same ground. iOS/web skip step 1.

---

## CI/CD

Tags are the source of truth. **No manual `app.json` version bumps** — `versionName` is derived from git tags by CI scripts and `expo.version` is rewritten before each build.

| Trigger                            | Workflow               | Play Track            |
| ---------------------------------- | ---------------------- | --------------------- |
| Push to `master`                   | `android-internal.yml` | Internal Testing      |
| GH **pre-release** `vX.Y.Z-beta.N` | `android-beta.yml`     | Open Testing          |
| GH **full release** `vX.Y.Z`       | `android-promote.yml`  | Production (promoted) |
| GH **full release** `vX.Y.Z`       | `web-deploy.yml`       | Web app (Coolify)     |

Build workflows: Ubuntu 24.04, JDK 17, Node 22, SDK 35; `npm ci` → `expo prebuild --clean` → `gradlew bundleRelease` → upload. Promote does NOT rebuild — it copies the highest-versionCode completed `X.Y.Z-beta.*` AAB byte-identically to Production via the Play Developer API (idempotent). The AAB's internal `versionName` keeps the `-beta.N` suffix for traceability; `HelpModal` strips it so production shows clean semver. web-deploy force-updates a CI-owned `release` branch to the tagged commit, which Coolify tracks.

**Hard invariants (do NOT change):**

- **Release workflows MUST trigger on `published`, never `prereleased`.** GitHub does not fire `prereleased` when a pre-release is published from a DRAFT, and our drafters always create drafts, so the workflow would silently never run. Use `types: [published]` and check `github.event.release.prerelease` in the job's `if:`. Tested on a scratch repo, July 2026: publishing a draft pre-release fires only `published`; publishing a draft full release fires `published` and `released`. `released` is therefore safe and is why `android-promote.yml` and `web-deploy.yml` are left as they are.
- **ABIs are ARM-only** (`arm64-v8a,armeabi-v7a`). x86/x86_64 are deliberately excluded; emulators run ARM via translation. Do NOT re-add.
- **`useLegacyPackaging` MUST stay `true`** (via `expo-build-properties` in `app.json`). It forces `extractNativeLibs="true"`; with `false`, Android 11 and below have a buggy direct-from-APK path for `libc++_shared.so` that fatally crashes RN's New Architecture at `MainApplication.onCreate` (100% Android 11, real devices). Android 12+ is unaffected, but do NOT flip back.

Secrets: `EXPO_PUBLIC_CLARITY_KEY`, `ANDROID_KEYSTORE_BASE64`/`_PASSWORD`, `ANDROID_KEY_ALIAS`/`_PASSWORD`, `GOOGLE_SERVICES_JSON_BASE64`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `EAS_PROJECT_ID`, `EAS_OWNER`. Author each `vX.Y.Z` release body to summarise the whole cycle since the previous production release (users skip intermediate betas).

---

## Local On-Device Testing (MacBook M1)

Device table, flash commands, and adb/Metro/Gradle gotchas live in the `on-device-testing` skill (`.claude/skills/on-device-testing/SKILL.md`) so they load only when you're actually working with hardware.

---

## Conventions

- **TypeScript strict.** `T[]` not `Array<T>`. `Pressable` not `Button`.
- **Components.** Function declarations for default exports; handlers in `useCallback`; `React.memo` on list items.
- **Error handling.** Empty/commented `catch` for production silence. No `console.log` — use `dlog` at boundaries.
- **Naming.** `camelCase` vars/functions, `UPPER_SNAKE_CASE` constants, `PascalCase` types. **Imports** via absolute aliases (`@/components/`, `@/constants/`).
- `(window as any).Notification` and `onHoverIn as any` are intentional RN-Web escape hatches — leave them.
- **Git.** No `Co-Authored-By: Claude`/`Anthropic` trailers, ever. Confirm before committing to `master`/`main`/`production`.
