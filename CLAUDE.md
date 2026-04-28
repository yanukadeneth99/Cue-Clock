# Cue Clock: CLAUDE.md

Developer reference for AI-assisted work on this repository.

> **⚠ This is a public repository.**
> Before committing or pushing anything, double-check:
>
> - **Security**: No secrets, API keys, tokens, credentials, internal URLs, or private config (check `.env`, `google-services.json`, keystores, etc.).
> - **Brand**: No unreleased feature names, internal codenames, partner names, or confidential roadmap details.
>   When in doubt, ask before pushing.

---

## What This App Does

**Cue Clock** is a specialized time management tool for broadcast professionals. It allows users to monitor multiple timezones and track countdown timers simultaneously with high reliability and precision.

### Core Features

- **Dual live clocks**: Display two side-by-side clocks, each configurable to any of 18 broadcast timezones.
- **Multiple countdown timers**: Create, name, and manage infinite countdowns tied to specific timezones.
- **Deduction offsets**: Subtract "pre-show buffer" durations from countdown targets (useful for live show prep).
- **On-air (Full-screen) mode**: A distraction-free display that strips away controls for studio use.
- **Persistent state**: All settings, zones, and timers are saved locally across sessions via AsyncStorage.
- **Per-timer alerts**: Configurable "minutes-before" push notifications and in-app alerts.
- **12/24-hour clock format**: User-selectable display preference (toggle in Help modal), persisted across sessions. Affects live clocks and target time displays; countdown duration stays in 24h style.
- **In-app help**: Integrated guide explaining all controls and usage patterns.

---

## Project Structure

```
app/              # React Native (Expo) Mobile Application
  app/            # Expo Router (file-based) directory
    _layout.tsx   # Root layout: font loading, Expo Router stack, Clarity analytics init
    index.tsx     # Main screen: all primary state and logic lives here (~839 lines)
    +not-found.tsx# 404 catch-all route
  components/     # UI Components
    AnalyticsConsentModal.tsx        # First-launch GDPR-compliant opt-in modal (non-dismissable)
    AnalyticsOptOutModal.tsx         # Opt-out confirmation modal (shown when user turns off analytics)
    AndroidBackgroundHelpModal.tsx   # Step-by-step guide to enable Android background activity
    ClockPicker.tsx                  # Dual live-clock with timezone pickers
    TargetBlock.tsx                  # Countdown card with name, times, zone, alert, collapse, delete
    AlertModal.tsx                   # Minutes-before alert configuration modal
    ConfirmModal.tsx                 # Generic yes/no confirmation dialog
    HelpModal.tsx                    # In-app help overlay with 24h toggle, controls guide, about section
  lib/            # Shared modules
    analytics.ts  # Firebase/Clarity analytics initialisation (extracted from _layout.tsx)
    alarms.ts     # Notifee alarm and notification scheduling wrapper
  constants/      # App-wide constants
    colors.ts     # 14-color dark broadcast palette
    timezones.ts  # 18 broadcast timezone definitions
  plugins/        # Expo Config Plugins
    withFullScreenAlarm.js # Adds showWhenLocked and turnScreenOn to MainActivity
  assets/         # Icons, splash screens, fonts (SpaceMono-Regular.ttf), alarm.mp3 (alarm tone)
  scripts/        # Maintenance and utility scripts
  .env.example    # Template for environment variables (safe, no secrets)
  app.json        # Expo configuration (slug, bundle ID, plugins)
  app.config.js   # Dynamic Expo config: injects EAS projectId/owner from env at build time
  eas.json        # EAS build configs: development (internal), preview (APK), production
  package.json    # Mobile app dependencies and scripts
  metro.config.js # Metro bundler configuration
  babel.config.js # Expo preset

website/          # Next.js Landing Page & Documentation
  src/app/
    page.tsx      # Landing page with GSAP animations, contributor grid, download buttons
    layout.tsx    # Root layout: SEO metadata, fonts, dark theme
    privacy/page.tsx  # Privacy policy explaining data collection and user rights
    globals.css   # Tailwind 4, material icons, glassmorphism components
    robots.ts     # SEO robots.txt generation
    sitemap.ts    # SEO sitemap (cueclock.app)
  public/         # Static assets (SVGs)
  package.json    # Website dependencies and scripts


.github/workflows/
  android-internal.yml # CI/CD: build + sign AAB + upload to Google Play internal track (master pushes)
  android-release.yml  # CI/CD: build + sign AAB + upload to Google Play beta track (GitHub releases)

Root Documentation
  DEVELOPMENT.md              # How to run the app locally (zero setup required)
  GITHUB_SECRETS_SETUP.md     # How to configure GitHub Secrets for CI/CD
  CONTRIBUTING.md             # Contributing guidelines
  CODE_OF_CONDUCT.md          # Community standards
  LICENSE                     # AGPL-3.0
  SECURITY.md                 # Security vulnerability reporting
```

---

## Tech Stack

### Mobile (`app/`)

| Layer           | Technology                                | Version              |
| --------------- | ----------------------------------------- | -------------------- |
| Framework       | React Native                              | 0.83.2               |
| SDK             | Expo                                      | 55                   |
| Navigation      | Expo Router                               | 55 (file-based)      |
| Language        | TypeScript                                | ~5.9.2 (strict mode) |
| Styling         | Inline Styles                             | -                    |
| Date/Time       | Luxon                                     | 3.7.1                |
| Persistence     | @react-native-async-storage/async-storage | 2.2.0                |
| Notifications   | @notifee/react-native + expo-notifications | 9.1.8 / 55          |
| Audio (alarm)   | expo-audio (+ expo-asset peer)             | ~55.0.14             |
| Pickers         | @react-native-picker/picker               | 2.11.4               |
| DateTime Picker | react-native-modal-datetime-picker        | 18.0.0               |
| Analytics       | @microsoft/react-native-clarity           | 4.5.3                |

### Website (`website/`)

| Layer      | Technology         | Version        |
| ---------- | ------------------ | -------------- |
| Framework  | Next.js            | 16.2.3         |
| React      | React              | 19.2.4         |
| Animations | GSAP + @gsap/react | 3.14.2 / 2.1.2 |
| Styling    | Tailwind CSS       | 4              |
| Language   | TypeScript         | 6              |

---

## Architecture & Key Concepts

### Component Tree (Mobile)

```
HomeScreen (app/app/index.tsx)
├── ClockPicker                 : Dual live-clock with timezone pickers
├── TargetBlock[]               : One per countdown; collapsible; includes AlertModal + ConfirmModal
│   ├── AlertModal              : Set/delete countdown alert
│   └── ConfirmModal            : Delete confirmation dialog
├── HelpModal                   : In-app help overlay (triggered by ? button in header)
│   └── (opens) AndroidBackgroundHelpModal: Background-permissions guide (Android only)
├── AnalyticsConsentModal       : First-launch opt-in (non-dismissable)
└── AnalyticsOptOutModal        : Opt-out confirmation (shown when user turns off analytics)
```

### State Management

All state is lifted to `HomeScreen` and persisted via AsyncStorage (`multiSet`/`multiGet`). State is rehydrated on mount.

- `zone1` / `zone2`: Timezone strings.
- `targetBlocks`: JSON-serialized `TargetBlockType[]`.
- `fullScreen`: Boolean for on-air mode.
- `is24Hour`: Boolean clock-format preference (default `true`). Persisted; missing key defaults to `true` (backwards-safe). Affects live clocks and target time displays only: countdown durations stay in 24h style.
- `analyticsEnabled`: Three-state (`null` = not yet given, `true` = accepted, `false` = declined). **Preserved on reset**: `doReset` uses `multiRemove` on specific keys, not `AsyncStorage.clear`.
- `consentModalVisible`: Boolean for first-launch analytics consent modal visibility.
- `helpVisible` / `resetModalVisible`: Modal visibility booleans.
- `notifBlocked`: Web notification permission state (web only).
- `exitButtonOpacity`: Fullscreen exit button fade (auto-dims after 3s).

### Countdown Algorithm

1. Get current time in the block's selected timezone (Luxon `DateTime`).
2. Construct a target `DateTime` for today at the block's `targetHour:targetMinute`.
3. If the target is already past, add 1 day (next occurrence).
4. Subtract the deduction (`deductHour:deductMinute`).
5. Compute the difference → format as `HH:MM:SS`.
6. Recalculate every 1 second via `setInterval` in `HomeScreen`.
7. Optimization: Skip object spread/React reconciliation if the formatted countdown string hasn't changed.

### Alert System

Dual-mode alert system powered by Notifee with graceful fallbacks:

**Alarm Mode** (Primary: Android full-screen intents)

- Full-screen notification that wakes device and shows over lock screen via Notifee's `fullScreenAction`
- Audio + haptics are played **in-activity** by `AlarmDismissModal` using `expo-audio` (looping `assets/alarm.mp3` at full volume) and `Vibration.vibrate(pattern, true)`. The notification's channel sound is intentionally a fallback only — Android suppresses channel sound the moment a full-screen intent launches an Activity, so the alarm UX is owned by the React component
- 60-second safety cap stops sound + vibration automatically if the operator never acts (prevents an unattended phone from sounding forever during a live show)
- Cold-start path: when Android launches the app from a killed state via `fullScreenAction`, `notifee.getInitialNotification()` is read after AsyncStorage hydration and the modal opens with the correct block context
- Requires `android.permission.POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, and the Android 14+ "Full-screen notifications" per-app toggle (gated at runtime via `canScheduleExactAlarms()` and `canUseFullScreenIntent()`; both deep-link to settings if missing)
- Automatically snoozes (5 max) when snoozed; creates fresh trigger notification
- Uses `ALARM_CHANNEL_ID: "cue-clock-alarm-v3"` (channel versioning ensures fresh setup on Android — channels are immutable post-creation; stale v1/v2 channels are explicitly deleted on first run)
- Works even when app is backgrounded or device in Doze mode (via AlarmManager `SET_EXACT_AND_ALLOW_WHILE_IDLE`)
- Requires `showWhenLocked` and `turnScreenOn` manifest attributes (set by `withFullScreenAlarm` plugin)

**Notification Mode** (Fallback: standard heads-up)

- Visible heads-up notification if full-screen intent permission not granted (Android 14+)
- Uses `NOTIF_CHANNEL_ID: "cue-clock-notif-v3"` with default sound and vibration
- Survives Doze via exact timestamp triggers

**Common behaviors**

- **Queue system**: Fired alerts tracked in a ref; processed in useEffect to prevent duplicates
- **Trigger condition**: `totalMinutes === alertMinutesBefore && seconds === 0`
- **Auto-clears**: Alert config is removed from the block after firing
- **Web/iOS fallback**: Uses Web Notifications API → `window.alert` as final fallback
- **Expo Go guard**: Notification registration skipped in Expo Go environment (dev limitation)

### Platform-Specific UI

- **Web**: +Add button and ? help in header; more controls exposed; tooltips; select/input HTML elements styled via platform-injected inline styles.
- **Mobile**: Footer-based controls; simpler layout.
- **Detection**: `Platform.OS === "web" | "ios" | "android"`.

### Color Scheme

The app uses a specific dark blue-gray palette for high visibility in broadcast environments.

- `background` : `#1a1d23` (Main app background)
- `surface` : `#252830` (Card and modal backgrounds)
- `surfaceBorder` : `#353840` (Card and modal borders)
- `header` : `#e8eaed` (Primary light text)
- `zone1` : `#4ade80` (Green-400, first clock)
- `zone2` : `#f87171` (Red-400, second clock)
- `countdown` : `#fbbf24` (Amber-400, timer text)
- `muted` : `#8b8f96` (Secondary text)
- `danger` : `#ef4444` (Destructive actions)
- `accent` : `#60a5fa` (Blue-400, interactive elements)
- `pickerText` : `#e8eaed` (Time picker foreground)
- `pickerBg` : `#2f323a` (Time picker background)
- `border` : `#3f434d` (General structural borders)

Colors are defined in `app/constants/colors.ts` and used via the `colors` object.

### Typography

- **Headline/Monospace**: `SpaceMono-Regular` (countdown timers, loaded via `useFonts` in `_layout.tsx`)
- **Website Headline**: Space Grotesk (bold)
- **Website Body**: Inter (regular)
- **Countdown**: `fontVariant: ['tabular-nums']` for stable width during ticks

### Alarm Scheduling (`lib/alarms.ts`)

Thin wrapper around `@notifee/react-native` for scheduling and managing countdown alerts. All Notifee API calls are inside function bodies (never at module load) so the file safely imports on web and iOS.

**Key exports:**

- `scheduleAlarm(block, fireDate)` – Schedule alarm-mode notification
- `scheduleNotif(block, fireDate)` – Schedule fallback heads-up notification
- `scheduleAlarmFromData(blockId, blockName, alertMinutesBefore, fireDate)` – Schedule from raw data (used in snooze)
- `scheduleNotifFromData(...)` – Fallback notification from raw data
- `displayNotif(title, body)` – Display immediate foreground notification
- `cancelAlarm(id)` – Cancel by notification ID
- `canUseFullScreenIntent()` – Check if app has permission to use full-screen (Android 14+)
- `openFullScreenIntentSettings()` – Launch system settings to grant full-screen permission
- `canScheduleExactAlarms()` – Check Android 12+ SCHEDULE_EXACT_ALARM permission via Notifee's `settings.android.alarm`
- `openAlarmPermissionSettings()` – Deep-link to the dedicated "Alarms & reminders" page
- `ensureAlarmChannel()` / `ensureNotifChannel()` – Create Android channels on first use; explicitly delete stale `v1`/`v2` channel IDs to recover from prior broken-channel state
- `requestAlarmPermissions()` – Request notification & scheduling permissions

**Channel versioning:** Channels are versioned (`v3`) so Android recreates them with locked-in sound/vibration settings. Notifee deletes stale `cue-clock-alarm`, `cue-clock-alarm-v2`, `cue-clock-notif`, and `cue-clock-notif-v2` IDs on first run for users upgrading from older builds.

**Exact triggers:** Both alarm and notification modes use `AlarmManager.SET_EXACT_AND_ALLOW_WHILE_IDLE` to survive Doze and fire at exact scheduled time.

### Fullscreen Layout Pattern

Uses a **single `View` root** (to prevent native crashes from tree remounts) with conditional children.

- `ClockPicker` is pinned above a `ScrollView`.
- `TargetBlock` list is inside the `ScrollView` (scroll enabled only when blocks overflow available space).
- Exit button is fixed at the bottom; auto-dims after 3 seconds of inactivity via opacity animation.
- Safe area padding is dynamically calculated using `useSafeAreaInsets()`.
- Countdown font size scales dynamically: `countdownFontSize = screenHeight / blockCount` (shrinks as blocks increase).

### Expo Config Plugins

**`withFullScreenAlarm`** (`app/plugins/withFullScreenAlarm.js`)

- Adds `android:showWhenLocked="true"` and `android:turnScreenOn="true"` to MainActivity manifest
- Allows Notifee's `fullScreenAction` to launch app over lock screen and wake device when alarm fires
- Registered in `app.json` plugins array and automatically applied during prebuild
- Android-only; safe to call on other platforms (returns config unmodified)

---

## CI/CD & Build Pipeline

### Pipeline Strategy

**Two-track deployment approach:**

| Trigger               | Workflow               | Track                 | Audience         | Purpose             |
| --------------------- | ---------------------- | --------------------- | ---------------- | ------------------- |
| Push to `master`      | `android-internal.yml` | Internal Testing      | Dev team + QA    | Continuous testing  |
| Create GitHub Release | `android-release.yml`  | Closed Testing (Beta) | Selected testers | Alpha/beta releases |

### Android Internal Testing Workflow (`.github/workflows/android-internal.yml`)

**Trigger**: Push to `master` branch
**Runner**: Ubuntu 24.04 with Java 17, Node 22, Android SDK 35

**Steps**:

1. Checkout code
2. Setup Java 17, Node.js 22 with npm cache
3. Free up disk space (removes NDK, dotnet, Swift)
4. `npm ci` in `app/`
5. `npx expo-doctor` (continues on error)
6. `npx expo prebuild --platform android --clean`
7. Restrict build to `arm64-v8a` architecture
8. Decode Base64 Firebase config → `google-services.json`
9. Decode Base64 keystore secret → `release.keystore`
10. Setup Gradle with persistent cache
11. Build signed release AAB via `./gradlew bundleRelease`
12. Upload signed AAB directly to Google Play internal testing track via service account

### Android Release Workflow (`.github/workflows/android-release.yml`)

**Trigger**: GitHub Release creation/publication
**Runner**: Ubuntu 24.04 with Java 17, Node 22, Android SDK 35

**Steps**: Same as internal workflow, but uploads to **beta track** with release notes.

**Key difference**: Includes release notes from the GitHub Release body:

```yaml
releaseNotes: ${{ github.event.release.body }}
```

**Manual trigger option**: Both workflows support `workflow_dispatch` for manual GitHub Actions dashboard trigger.

### Required GitHub Secrets

| Secret                             | Description                                             |
| ---------------------------------- | ------------------------------------------------------- |
| `EXPO_PUBLIC_CLARITY_KEY`          | Microsoft Clarity project ID                            |
| `ANDROID_KEYSTORE_BASE64`          | Base64-encoded `.keystore` file                         |
| `ANDROID_KEYSTORE_PASSWORD`        | Keystore password                                       |
| `ANDROID_KEY_ALIAS`                | Key alias (`cue-clock-key`)                             |
| `ANDROID_KEY_PASSWORD`             | Individual key password                                 |
| `GOOGLE_SERVICES_JSON_BASE64`      | Base64-encoded `google-services.json` (Firebase config) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Cloud service account JSON for Play API          |
| `EAS_PROJECT_ID`                   | Expo EAS project ID for official builds                 |
| `EAS_OWNER`                        | Expo account username                                   |

**Package name**: `com.yanukadeneth99.cueclock` (must match `app.json` and Google Play Console app)

### Creating a Release

1. Go to **GitHub** → **Releases** → **Create a new release**
2. Enter tag name (e.g., `v1.0.0`)
3. Set target to `master` branch
4. Write release notes in the description (format with `## Features`, `## Bug Fixes`, etc.)
5. ✅ Check **"This is a pre-release"** for alpha/beta testing
6. Click **"Publish release"**

→ Pipeline automatically triggers, builds signed AAB, and uploads to Google Play beta track with release notes.

---

## Engineering Standards

### 1. Speed & Reliability (Primary Mandate)

- **Minimal overhead**: Avoid heavy libraries or unnecessary re-renders.
- **Simple Designs**: Prefer flat logic over clever abstractions.
- **Intuitive UX**: Controls must be obvious to a stressed operator.

### 2. Styling Standards

- **Inline Style Props**: Use for all layout and visual properties.
- **Color Scheme**: Strictly source colors from `app/constants/colors.ts`.
- **Picker Rendering**: Never use fixed `height` or `overflow: hidden` on `@react-native-picker/picker` containers (fixes Android clipping).
- **Safe Area**: Always use `useSafeAreaInsets()`; never hardcode platform offsets.

### 3. Coding Conventions

- **TypeScript**: Strict mode enabled. Use `T[]` not `Array<T>`.
- **Performance**: Use `useCallback` for handlers and `React.memo` on list items (`TargetBlock`).
- **Error Handling**: Use empty or comment-only `catch` blocks for production-safe silence; no `console.log` in production.
- **Documentation**: Exported components and functions must have JSDoc describing props/parameters.
- **Interaction**: Use `Pressable` instead of `Button` for custom-styled elements.
- **`any` Type Pattern**: `(window as any).Notification` and `onHoverIn/Out as any` spreads are intentional RN-Web escape hatches where no typed API exists. Do not remove these.

### 4. Git Conventions

- **Commit Messages**: Never add Anthropic or Claude author lines (no `Co-Authored-By` trailers) in commit messages.
- **Branch Policy**: Always ask for confirmation before committing directly to `master`, `main`, or `production` branches.

### 5. Build & Deployment Notes

- **Docker removed**: Legacy `docker/` directory has been removed. Use Expo CLI (`npx expo prebuild`) for Android builds instead.
- **Unused imports cleaned**: `app/hooks/useColorScheme.ts` was removed (RN built-in is not needed for this app's dark-only theme).

---

## Development Commands

### Mobile App (`app/`)

```bash
npx expo start         # Start dev server
npx expo run:android   # Run on Android emulator/device
npx expo run:ios       # Run on iOS simulator/device
npm run lint           # Run ESLint
```

### Website (`website/`)

```bash
npm run dev            # Start Next.js dev server
npm run build          # Build for production
```

--

## Codebase Flavor & Conventions

### 1. Naming Conventions

- **Variables**: `camelCase` (e.g., `targetBlocks`, `fullScreen`). Booleans often use prefixes like `is` or suffixes indicating state (e.g., `isCollapsed`, `notifBlocked`, `analyticsEnabled`).
- **Constants**: Global/magic constants are written in `UPPER_SNAKE_CASE` (e.g., `FULLSCREEN_CLOCK_HEIGHT`, `BLOCK_OVERHEAD`).
- **Functions**: `camelCase` using action verbs (e.g., `toggleFullScreen`, `handleTargetConfirm`, `updateTargetTime`, `computeAlertFireDate`).
- **Classes/Types**: `PascalCase` for TypeScript Interfaces and Types (e.g., `TargetBlockType`, `Props`).

### 2. Function & Class Structures

- **Function Creation**: React components use standard function declarations (`export default function ComponentName()`). Internal component handlers and callbacks use Arrow Functions wrapped in `useCallback` (`const handler = useCallback(() => {}, [])`).
- **Class Creation**: Functional components and hooks are used exclusively instead of ES6 classes.
- **Export/Import Styles**: Default exports are preferred for main components and screens. Imports use absolute aliasing (e.g., `@/components/`, `@/constants/`).

### 3. Coding Paradigms & Quirks

- **Error Handling**: Uses `try/catch` with empty or comment-only `catch` blocks for production-safe silence (`} catch { // silently fail }`). Promise `.catch(() => {})` chains are also common. No `console.log` in production.
- **Control Flow**: Extensive use of early returns (guard clauses) to avoid deeply nested `if/else` statements.
- **State & Rendering**: All state is lifted to parent components. Heavy reliance on `useRef` for mutable state that shouldn't trigger re-renders, and `useCallback`/`React.memo` for performance optimization.
- **Fire-and-forget async handlers**: Time/alert mutations (e.g. `handleTargetConfirm`, `handleAlertConfirm`, `removeBlock`) apply state updates synchronously first, then reschedule notifications in a background IIFE (`(async () => { ... })()`). This keeps UI response <16ms instead of blocking on native notification APIs (~500ms).
- **Comment Style**: JSDoc is used for exported functions and components. Inline comments explain "why" specific edge cases or platform quirks are handled.
- **Styling**: Relies heavily on inline styles in the React Native app, combined with platform-specific checks (`Platform.OS === "web"`). The Next.js website uses Tailwind CSS.

---

## License & Security

- **License:** AGPL-3.0. Commercial licensing: hello@yashura.io.
- **Security:** Not production-hardened. See `SECURITY.md` for reporting. Contact: hello@yashura.io.
