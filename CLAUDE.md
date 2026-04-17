# Cue Clock — CLAUDE.md

Developer reference for AI-assisted work on this repository.

---

## What This App Does

**Cue Clock** is a specialized time management tool for broadcast professionals. It allows users to monitor multiple timezones and track countdown timers simultaneously with high reliability and precision.

### Core Features

- **Dual live clocks** — Display two side-by-side clocks, each configurable to any of 18 broadcast timezones.
- **Multiple countdown timers** — Create, name, and manage infinite countdowns tied to specific timezones.
- **Deduction offsets** — Subtract "pre-show buffer" durations from countdown targets (useful for live show prep).
- **On-air (Full-screen) mode** — A distraction-free display that strips away controls for studio use.
- **Persistent state** — All settings, zones, and timers are saved locally across sessions via AsyncStorage.
- **Per-timer alerts** — Configurable "minutes-before" push notifications and in-app alerts.
- **In-app help** — Integrated guide explaining all controls and usage patterns.

---

## Project Structure

```
app/              # React Native (Expo) Mobile Application
  app/            # Expo Router (file-based) directory
    _layout.tsx   # Root layout: font loading, Expo Router stack, Clarity analytics init
    index.tsx     # Main screen — all primary state and logic lives here (~839 lines)
    +not-found.tsx# 404 catch-all route
  components/     # UI Components
    AnalyticsConsentModal.tsx  # First-launch GDPR-compliant opt-in modal (non-dismissable)
    ClockPicker.tsx            # Dual live-clock with timezone pickers
    TargetBlock.tsx            # Countdown card with name, times, zone, alert, collapse, delete
    AlertModal.tsx             # Minutes-before alert configuration modal
    ConfirmModal.tsx           # Generic yes/no confirmation dialog
    HelpModal.tsx              # In-app help overlay explaining all 11 controls
  constants/      # App-wide constants
    colors.ts     # 14-color dark broadcast palette
    timezones.ts  # 18 broadcast timezone definitions
  hooks/          # Shared hooks
    useColorScheme.ts  # Re-exports React Native's built-in hook
  assets/         # Icons, splash screens, fonts (SpaceMono-Regular.ttf)
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

docker/
  Dockerfile.android  # Ubuntu 24.04 image with Java 17, Node 22, Android SDK 35

scripts/
  build-android-local.sh  # Local Docker-based Android build (debug/release modes)

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
| Notifications   | expo-notifications                        | 55                   |
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
├── ClockPicker          — Dual live-clock with timezone pickers
├── TargetBlock[]        — One per countdown; collapsible; includes AlertModal + ConfirmModal
│   ├── AlertModal       — Set/delete countdown alert
│   └── ConfirmModal     — Delete confirmation dialog
└── HelpModal            — In-app help overlay (triggered by ? button in header)
```

### State Management

All state is lifted to `HomeScreen` and persisted via AsyncStorage (`multiSet`/`multiGet`). State is rehydrated on mount.

- `zone1` / `zone2`: Timezone strings.
- `targetBlocks`: JSON-serialized `TargetBlockType[]`.
- `fullScreen`: Boolean for on-air mode.
- `analyticsEnabled`: Three-state (`null` = not yet given, `true` = accepted, `false` = declined).
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

- **Queue system**: Fired alerts tracked in a ref; processed in useEffect to prevent duplicate notifications.
- **Trigger condition**: `totalMinutes === alertMinutesBefore && seconds === 0`.
- **Auto-clears**: Alert config is removed from the block after firing.
- **Notification priority**: `expo-notifications` → Web Notifications API → `window.alert` fallback.
- **Android**: Requires notification channel (default, MAX importance, vibration) on first app launch.
- **Web**: "Notifications blocked" tag appears in header if permission denied (clickable to re-request).
- **Expo Go guard**: Notification registration is skipped in Expo Go and web environments.

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

### Fullscreen Layout Pattern

Uses a **single `View` root** (to prevent native crashes from tree remounts) with conditional children.

- `ClockPicker` is pinned above a `ScrollView`.
- `TargetBlock` list is inside the `ScrollView` (scroll enabled only when blocks overflow available space).
- Exit button is fixed at the bottom; auto-dims after 3 seconds of inactivity via opacity animation.
- Safe area padding is dynamically calculated using `useSafeAreaInsets()`.
- Countdown font size scales dynamically: `countdownFontSize = screenHeight / blockCount` (shrinks as blocks increase).

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
12. Generate downloadable artifact (30-day retention) for manual upload to Google Play internal testing track

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

### Local Android Build (`scripts/build-android-local.sh`)

- **Debug** (default): `./gradlew assembleDebug` → APK output
- **Release** (`--release` flag): Requires env vars `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
- Runs inside the `docker/Dockerfile.android` container

### Docker (`docker/Dockerfile.android`)

Custom Android build environment (not currently used by CI — CI uses `thyrlian/android-sdk:latest`). Useful for local builds without manual SDK installation.

- Ubuntu 24.04, OpenJDK 17, Node.js 22
- Android SDK: platform-tools, platforms;android-35, build-tools;34.0.0, ndk;26.1.10909125

---

## Engineering Standards

### 1. Speed & Reliability (Primary Mandate)

- **Minimal overhead** — Avoid heavy libraries or unnecessary re-renders.
- **Simple Designs** — Prefer flat logic over clever abstractions.
- **Intuitive UX** — Controls must be obvious to a stressed operator.

### 2. Styling Standards

- **Inline Style Props** — Use for all layout and visual properties.
- **Color Scheme** — Strictly source colors from `app/constants/colors.ts`.
- **Picker Rendering** — Never use fixed `height` or `overflow: hidden` on `@react-native-picker/picker` containers (fixes Android clipping).
- **Safe Area** — Always use `useSafeAreaInsets()`; never hardcode platform offsets.

### 3. Coding Conventions

- **TypeScript** — Strict mode enabled. Use `T[]` not `Array<T>`.
- **Performance** — Use `useCallback` for handlers and `React.memo` on list items (`TargetBlock`).
- **Error Handling** — Use empty or comment-only `catch` blocks for production-safe silence; no `console.log` in production.
- **Documentation** — Exported components and functions must have JSDoc describing props/parameters.
- **Interaction** — Use `Pressable` instead of `Button` for custom-styled elements.
- **`any` Type Pattern** — `(window as any).Notification` and `onHoverIn/Out as any` spreads are intentional RN-Web escape hatches where no typed API exists. Do not remove these.

### 4. Git Conventions

- **Commit Messages** — Never add Anthropic or Claude author lines (no `Co-Authored-By` trailers) in commit messages.
- **Branch Policy** — Always ask for confirmation before committing directly to `master`, `main`, or `production` branches.

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

### Local Android Build

```bash
# Debug APK
./scripts/build-android-local.sh

# Signed release APK
KEYSTORE_PATH=... KEYSTORE_PASSWORD=... KEY_ALIAS=... KEY_PASSWORD=... \
  ./scripts/build-android-local.sh --release
```

---

## Codebase Edit History (2026)

### 2026-04-17: Dependency Security Updates & PR Cleanup

- **Security:** Bumped Next.js `16.2.1 → 16.2.3` (XSS patch); added `protobufjs ^7.5.5` to `app/` (transitive Firebase vuln fix).
- **PR #54:** Removed unused `zone1`/`zone2` props from `TargetBlock` (dead prop drilling; reduces `React.memo` comparison cost and eliminates false invalidation trap on zone changes).
- **PR #55:** Added runtime validation of GitHub contributors API response in `website/src/app/page.tsx` — `unknown` type guard with `Array.isArray` + URL allowlist filter (`startsWith('https://github.com/')`) prevents XSS via API tampering.

### 2026-04-14: Removal of Unused EAS Configuration

- Deleted `app/eas.json` — build pipeline uses `expo prebuild` + Gradle directly; EAS cloud builds never invoked. CI/CD unchanged; `EAS_PROJECT_ID`/`EAS_OWNER` fallback to safe defaults per `app.config.js`.

### 2026-04-05: TextInput Security Enhancement

- Added `maxLength={50}` to `TargetBlock` `TextInput` to prevent crashes/exploits from extreme input lengths.

### 2026-04-04: Open-Source Hardening & Zero-Dependency Local Development

- **Security:** Removed hardcoded `projectId`/`owner` from `app.json`; now injected via `app.config.js` at build time from GitHub Secrets.
- **Local Dev:** App runs with **zero env vars required** — all credentials optional with safe defaults (`EXPO_PUBLIC_CLARITY_KEY`, `ANDROID_KEYSTORE_*`, `EAS_*`, `google-services.json`).
- **Docs:** Added `DEVELOPMENT.md` (zero-setup contributor guide) and `GITHUB_SECRETS_SETUP.md`; clarified `.env.example`.
- **CI/CD:** Both workflows inject `EAS_PROJECT_ID`/`EAS_OWNER` from Secrets — no account identifiers in public repo.

### 2026-04-03: Alert & Sync Bug Fixes (Mobile)

- **Timer Desync:** Two separate `DateTime.now()` calls in the interval could differ by microseconds, causing zone1 vs zone2 to tick at visibly different times. Fix: capture one `DateTime.now()`, then `.setZone()` both clocks from the same millisecond.
- **Duplicate Foreground Notifications:** Pre-scheduled native notification + in-app `sendAlert` fired at the same second. Fix: queue the scheduled notification ID in `pendingCancelRef` and drain the queue in the alert-processing `useEffect` before calling `sendAlert`.
- **Background → Foreground Re-Alert:** JS `setInterval` pauses in background; when resuming, state still showed `alertMinutesBefore` set and fired again. Fix: `AppState.addEventListener('change')` silently marks alerts fired if their fire time has already passed (native already notified the user). Listener cleans up via `subscription.remove()`.
- **Root cause:** The 2026-04-02 O(1) interval optimization exposed these pre-existing bugs by making the interval run reliably every second.

### 2026-04-02: Security & Performance Patches

- **CI/CD Injection Fix (`android-release.yml`):** Previously `${{ github.event.release.tag_name }}` was interpolated directly into inline bash/Node scripts — a malicious tag like `v1.0"; rm -rf /; echo "` could execute arbitrary code. Fix: pass values via the `env` block, access as `$VAR` (bash) / `process.env.VAR` (Node).
- **Countdown Interval O(1):** Pre-computed `DateTime.now().setZone(...)` outside the `blocks.map` loop inside `setInterval`. Benchmark: **~27% speedup** (14879ms → 10811ms over 100 iterations × 1000 blocks). Also makes `setTargetBlocks` a pure updater.

### 2026-04-01: Website Security & YASHURA Rebranding

- **Reverse Tabnabbing fix:** Added `rel="noopener noreferrer"` to external `target="_blank"` anchors in `page.tsx`.
- **JSON-LD XSS fix:** Appended `.replace(/</g, '\\u003c')` to `JSON.stringify(jsonLd)` in `layout.tsx` to prevent premature `<script>` closure.
- **Rebrand:** Footer → YASHURA (yashura.io) with X/LinkedIn icons; web CTA → "Start Now" (live.cueclock.app); removed desktop "Get Started"; added Privacy Policy footer link.
- **SEO:** JSON-LD WebApplication schema, logo_cropped.png OG/Twitter image, privacy page in sitemap; fixed Material Symbols font loading (preconnect + `display=block`).
- **Lint/fonts:** Fixed 9 ESLint errors (unescaped entities, `<a>` → `<Link>`); added `display: "swap"` to Space Grotesk & Inter.

### 2026-03-31: GDPR Analytics & Dual CI/CD Pipeline

- Non-dismissable first-launch analytics consent modal (three-state: `null` / `true` / `false`).
- Privacy policy at `/privacy` with GDPR/CCPA compliance.
- Dual-track CI/CD: internal testing (master push) + beta release (GitHub Release).
- Firebase config moved to Secrets; Gradle caching cut build time 50 → 10–15 min.

### 2026-03-27: Web UX & Clarity Analytics

- Delete confirmation modal (`ConfirmModal`) added to `TargetBlock`.
- Web Notifications API with `window.alert` fallback; "Notifications blocked" clickable header tag.
- Circular "+Add Target" button in web header; Microsoft Clarity integrated (project ID `w2c5ecuzj5`).

### 2026-03-11: Performance, Notifications & Timezones

- `React.memo` on `TargetBlock`; reference-stable interval (15+ blocks lag-free).
- `expo-notifications` with `Alert.alert` fallback; "Reset All" confirmation.
- Timezones expanded 8 → 18 broadcast zones.

### 2026-03-10: Fullscreen Layout & Stability

- Dynamic `countdownFontSize` (shrinks as block count increases).
- Single-root `View` pattern fixes native crashes on fullscreen toggles.
- Migrated to inline styles (Android reliability); created `HelpModal.tsx` for 11 UI controls.

---

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
- **Comment Style**: JSDoc is used for exported functions and components. Inline comments explain "why" specific edge cases or platform quirks are handled.
- **Styling**: Relies heavily on inline styles in the React Native app, combined with platform-specific checks (`Platform.OS === "web"`). The Next.js website uses Tailwind CSS.

---

## License & Security

- **License:** AGPL-3.0. Commercial licensing: hello@yashura.io.
- **Security:** Not production-hardened. See `SECURITY.md` for reporting. Contact: hello@yashura.io.
