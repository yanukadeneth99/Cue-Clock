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

## Project Structure (Monolithic)

The project is organized into two primary sub-directories:

```
app/              # React Native (Expo) Mobile Application
  app/            # Expo Router (file-based) directory
    _layout.tsx   # Root layout: font loading, Expo Router stack
    index.tsx     # Main screen — all primary state and logic lives here
  components/     # UI Components (ClockPicker, TargetBlock, etc.)
  constants/      # App-wide constants (colors.ts, timezones.ts)
  hooks/          # Shared hooks (useColorScheme, useSafeAreaInsets)
  assets/         # Icons, splash screens, fonts
  scripts/        # Maintenance and utility scripts
  app.json        # Expo configuration
  package.json    # Mobile app dependencies and scripts

website/          # Next.js Landing Page & Documentation
  app/            # Next.js App Router directory
  public/         # Static assets
  package.json    # Website dependencies and scripts
```

---

## Tech Stack

### Mobile (app/)
| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 + Expo 54 |
| Navigation | Expo Router v6 (file-based) |
| Language | TypeScript ~5.9.3 (strict mode) |
| Styling | Inline Styles (primary) / NativeWind v4 (secondary) |
| Date/Time | Luxon v3 |
| Persistence | @react-native-async-storage/async-storage |
| Notifications| expo-notifications |
| Animations | react-native-reanimated ~4.1 |

### Website (website/)
| Layer | Technology |
|---|---|
| Framework | Next.js 15.2 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |

---

## Architecture & Key Concepts

### Component Tree (Mobile)
```
HomeScreen (app/app/index.tsx)
├── ClockPicker          — Dual live-clock with timezone pickers
├── TargetBlock[]        — One per countdown; collapsible; includes AlertModal
│   └── AlertModal       — Set/delete countdown alert
└── HelpModal            — In-app help overlay (triggered by ? button in header)
```

### State Management
All state is lifted to `HomeScreen` and persisted via AsyncStorage (`multiSet`/`multiGet`). State is rehydrated on mount.
- `zone1` / `zone2`: Timezone strings.
- `targetBlocks`: JSON-serialized `TargetBlockType[]`.
- `fullScreen`: Boolean for on-air mode.
- `helpVisible`: Boolean for help modal.

### Countdown Algorithm
1. Get current time in the block's selected timezone (Luxon `DateTime`).
2. Construct a target `DateTime` for today at the block's `targetHour:targetMinute`.
3. If the target is already past, add 1 day (next occurrence).
4. Subtract the deduction (`deductHour:deductMinute`).
5. Compute the difference → format as `MM:SS`.
6. Recalculate every 1 second via `setInterval` in `HomeScreen`.
7. Optimization: Skip object spread/React reconciliation if the formatted countdown string hasn't changed.

### Color Scheme
The app uses a specific dark blue-gray palette for high visibility in broadcast environments.
- `background`     : `#1a1d23` (Main app background)
- `surface`        : `#252830` (Card and modal backgrounds)
- `surfaceBorder`  : `#353840` (Card and modal borders)
- `header`         : `#e8eaed` (Primary light text)
- `zone1`          : `#4ade80` (Green-400, first clock)
- `zone2`          : `#f87171` (Red-400, second clock)
- `countdown`      : `#fbbf24` (Amber-400, timer text)
- `muted`          : `#8b8f96` (Secondary text)
- `danger`         : `#ef4444` (Destructive actions)
- `accent`         : `#60a5fa` (Blue-400, interactive elements)
- `pickerText`     : `#e8eaed` (Time picker foreground)
- `pickerBg`       : `#2f323a` (Time picker background)
- `border`         : `#3f434d` (General structural borders)

Colors are defined in `app/constants/colors.ts` and used via the `colors` object.

### Fullscreen Layout Pattern
Uses a **single `View` root** (to prevent native crashes from tree remounts) with conditional children.
- `ClockPicker` is pinned above a `ScrollView`.
- `TargetBlock` list is inside the `ScrollView` (scroll enabled only when blocks overflow available space).
- Exit button is fixed at the bottom.
- Safe area padding is dynamically calculated using `useSafeAreaInsets()`.

---

## Engineering Standards

### 1. Speed & Reliability (Primary Mandate)
- **Minimal overhead** — Avoid heavy libraries or unnecessary re-renders.
- **Simple Designs** — Prefer flat logic over clever abstractions.
- **Intuitive UX** — Controls must be obvious to a stressed operator.

### 2. Styling Standards
- **Inline Style Props** — Use for all layout and visual properties. NativeWind `className` is secondary due to inconsistent native Android rendering.
- **Color Scheme** — Strictly source colors from `app/constants/colors.ts`.
- **Picker Rendering** — Never use fixed `height` or `overflow: hidden` on `@react-native-picker/picker` containers (fixes Android clipping).
- **Safe Area** — Always use `useSafeAreaInsets()`; never hardcode platform offsets.

### 3. Coding Conventions
- **TypeScript** — Strict mode enabled. Use `T[]` not `Array<T>`.
- **Performance** — Use `useCallback` for handlers and `React.memo` on list items (`TargetBlock`).
- **Error Handling** — Use empty or comment-only `catch` blocks for production-safe silence; no `console.log` in production.
- **Documentation** — Exported components and functions must have JSDoc describing props/parameters.
- **Interaction** — Use `Pressable` instead of `Button` for custom-styled elements.

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

---

## Codebase Edit History (2026)

### 2026-03-27: Web UX Enhancements & Delete Confirmation
- **UX:** Added `ConfirmModal` to `TargetBlock` for delete confirmation (both web and mobile).
- **Web Notifications:** Implemented Web Notifications API with `window.alert` fallback; added "Notifications blocked" tag in header (clickable to re-request permission).
- **Header:** Added circular "Add Target" (+) button with tooltip in web header; moved "+ Add Target" out of footer for web.
- **Layout:** Fixed scrollbar to sit at viewport edge (moved `maxWidth` centering to `ScrollView.contentContainerStyle`); added `zIndex: 100` to header for tooltip layering.
- **ClockPicker:** Platform-aware time display size (48px web, 32px mobile); reduced picker container padding.
- **Fullscreen:** Exit Full Screen button is 50% width on web (`minWidth: 200`).
- **Website:** Fixed 5 ESLint errors in `website/src/app/page.tsx` (unescaped apostrophes, `any` types → proper types, `MouseEvent` cast).

### 2026-03-27: `any` Type Pattern
- **Standard:** `(window as any).Notification` and `onHoverIn/Out as any` spreads are intentional RN-Web escape hatches where no typed API exists. Do not attempt to remove these.

### 2026-03-11: Performance & Notifications
- **Optimization:** `React.memo` on `TargetBlock` and reference-stability in countdown interval (prevents lag with 15+ blocks).
- **Push Alerts:** Added `expo-notifications` (guarded for Expo Go compatibility) with `Alert.alert` fallback.
- **UX:** Added "Reset All" confirmation and increased safe-area padding for status/nav bar clearance.
- **Coverage:** Expanded timezones from 8 to 18.

### 2026-03-10: Layout & Stability
- **Overflow Fix:** Dynamic `countdownFontSize` in fullscreen mode (shrinks as blocks increase).
- **Architecture:** Moved to a single-root `View` pattern in `HomeScreen` to fix native crashes during fullscreen toggles.
- **Styling:** Migrated from NativeWind `className` to inline styles for Android reliability.
- **Help Modal:** Created `HelpModal.tsx` explaining all 11 UI controls.

---

## License & Security
- **License:** AGPL-3.0. Commercial licensing: hello@yashura.music.
- **Security:** Not production-hardened. See `SECURITY.md` for reporting. Contact: hello@yashura.music.
