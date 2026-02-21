# Broadcast Clock — CLAUDE.md

Developer reference for AI-assisted work on this repository.

---

## What This App Does

**Broadcast Clock** is a React Native (Expo) mobile app for broadcast professionals who need to monitor multiple timezones and track countdown timers simultaneously. Core functionality:

- Display two live clocks in different timezones side by side
- Create multiple named countdown timers, each tied to a specific timezone and target time
- Support a "deduction" offset subtracted from each countdown (useful for pre-show buffer calculations)
- Full-screen mode for on-air display
- Persistent state across sessions via AsyncStorage

---

## Non-Functional Requirements

### Speed is the primary non-functional requirement

This app is used in live broadcast environments where every second counts. All design and implementation decisions must prioritize:

- **Minimal overhead** — avoid unnecessary re-renders, heavy libraries, or background processing. Countdowns update every 1 second; nothing heavier should run on the main thread without justification.
- **Simple, understandable designs** — code and UI alike. Prefer flat logic over clever abstractions. A reader should understand a component in one pass.
- **Intuitive UX** — controls must be immediately obvious to a stressed operator. No hidden gestures, no multi-step flows for common actions, no ambiguous labels.

Every PR or change should be evaluated against these three criteria before anything else.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.79.5 + Expo 53 |
| Navigation | Expo Router v5 (file-based) |
| Language | TypeScript ~5.8.3 (strict mode) |
| Styling | NativeWind v4 / Tailwind CSS v3, twrnc for inline styles |
| Date/Time | Luxon v3 |
| Persistence | @react-native-async-storage/async-storage |
| Time pickers | react-native-modal-datetime-picker + @react-native-community/datetimepicker |
| Animations | react-native-reanimated ~3.17 |
| Build/Deploy | EAS (Expo Application Services) |

---

## Project Structure

```
app/
  _layout.tsx       # Root layout: font loading, Expo Router stack
  index.tsx         # Main screen — all primary state and logic lives here
  +not-found.tsx    # 404 fallback

components/
  ClockPicker.tsx   # Live dual-timezone clock display + timezone selector
  TargetBlock.tsx   # Individual countdown timer block (collapsible)

constants/
  colors.ts         # Single source of truth for the color palette
  timezones.ts      # Allowed timezones list (8 entries)

hooks/
  useColorScheme.ts # Thin wrapper around RN useColorScheme
```

---

## Key Concepts

### State (app/index.tsx)

| State | Type | Purpose |
|---|---|---|
| `zone1` | `string` | First timezone (displayed in green) |
| `zone2` | `string` | Second timezone (displayed in red) |
| `targetBlocks` | `TargetBlock[]` | All countdown timers |
| `fullScreen` | `boolean` | Toggle full-screen display mode |

All state is persisted to AsyncStorage on every change and rehydrated on mount.

### Countdown Algorithm

1. Get current time in the block's selected timezone (Luxon `DateTime`)
2. Construct a target `DateTime` for today at the block's `targetHour:targetMinute`
3. If the target is already past, add 1 day (next occurrence)
4. Subtract the deduction (`deductHour:deductMinute`)
5. Compute the difference → format as `MM:SS` (total minutes : seconds)
6. Recalculate every 1 second via `setInterval`

### Color Scheme

```
background  black
zone1       green
zone2       red
countdown   yellow
header      white
border      white
pickerText  black
```

All colors are defined in `constants/colors.ts`. Do not hardcode colors elsewhere.

### Supported Timezones

UTC, Asia/Colombo, Europe/Berlin, America/New_York, Asia/Tokyo, Australia/Sydney, Europe/London, America/Los_Angeles.

Defaults: `zone1 = Europe/Berlin`, `zone2 = Asia/Colombo`.

---

## Development Commands

```bash
# Start dev server
npx expo start

# Run on specific platform
npx expo run:android
npx expo run:ios
npx expo start --web

# Lint
npm run lint
```

---

## AsyncStorage Keys

| Key | Value |
|---|---|
| `zone1` | Timezone string |
| `zone2` | Timezone string |
| `targetBlocks` | JSON-serialized `TargetBlock[]` |

---

## Coding Conventions

- TypeScript strict mode is enabled — no `any`, no suppression without explanation.
- Styles use NativeWind `className` props; use `twrnc` only for dynamic/computed styles.
- Components should be self-contained and stateless where possible; lift state to `index.tsx`.
- No new external libraries without a strong justification — keep the bundle lean (speed requirement).
- Full-screen mode must be handled in every new UI component (`fullScreen` prop pattern).

---

## Platform Targets

- iOS (including tablet)
- Android (edge-to-edge, adaptive icons)
- Web (via react-native-web + Metro static output)

Android package: `com.yanukadeneth99.broadcastclock`

---

## Current Development Status

**Done:** Core countdown logic, dual-clock display, full-screen mode, multi-target support, persistence.

**Pending (from README):** Proper theme/design pass, logo/favicon/splash assets, animations, app store deployment.

---

## Security

This app is not production-hardened. See `SECURITY.md` for vulnerability reporting. Contact: yanukadeneth99@gmail.com.
