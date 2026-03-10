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
| Framework | React Native 0.81.5 + Expo 54 |
| Navigation | Expo Router v6 (file-based) |
| Language | TypeScript ~5.8.3 (strict mode) |
| Styling | NativeWind v4 / Tailwind CSS v3 |
| Date/Time | Luxon v3 |
| Persistence | @react-native-async-storage/async-storage |
| Time pickers | react-native-modal-datetime-picker + @react-native-community/datetimepicker |
| Animations | react-native-reanimated ~4.1 |
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
  AlertModal.tsx    # Modal for setting/managing countdown alerts
  HelpModal.tsx     # In-app help overlay explaining all controls

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
| `helpVisible` | `boolean` | Toggle help modal visibility |

All state is persisted to AsyncStorage via `multiSet`/`multiGet` and rehydrated on mount.

### Countdown Algorithm

1. Get current time in the block's selected timezone (Luxon `DateTime`)
2. Construct a target `DateTime` for today at the block's `targetHour:targetMinute`
3. If the target is already past, add 1 day (next occurrence)
4. Subtract the deduction (`deductHour:deductMinute`)
5. Compute the difference → format as `MM:SS` (total minutes : seconds)
6. Recalculate every 1 second via `setInterval`
7. Skip object spread when countdown string hasn't changed (optimization)

### Color Scheme

```
background       #1a1d23    (dark blue-gray)
surface          #252830    (card backgrounds)
surfaceBorder    #353840    (card borders)
header           #e8eaed    (light text)
zone1            #4ade80    (green-400)
zone2            #f87171    (red-400)
countdown        #fbbf24    (amber-400)
muted            #8b8f96    (secondary text)
danger           #ef4444    (destructive actions)
accent           #60a5fa    (blue-400, interactive elements)
pickerText       #e8eaed    (picker foreground, light)
pickerBg         #2f323a    (picker background, dark)
border           #3f434d    (general borders)
```

All colors are defined in `constants/colors.ts` and mirrored in `tailwind.config.js` under the `broadcast` namespace. Do not hardcode colors elsewhere.

### Styling Approach

Components use inline `style` props (not NativeWind `className`) for all layout and visual styling to ensure reliable rendering on native mobile platforms. NativeWind/Tailwind is configured but className should only be used as a secondary option.

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
- Styles use inline `style` props for reliable native rendering; NativeWind `className` may be used as a supplement but is not the primary styling method.
- Components should be self-contained and stateless where possible; lift state to `index.tsx`.
- Use `useCallback` for handlers passed as props to prevent unnecessary re-renders.
- Use `Pressable` instead of `Button` for custom-styled interactive elements.
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

**Done:** Core countdown logic, dual-clock display, full-screen mode, multi-target support, persistence, design polish pass, logo/favicon/splash assets, alert/alarm per target block, in-app help modal.

**Pending:** Animations, app store deployment.

---

## License

AGPL-3.0. Commercial licensing available — contact hello@yashura.music.

## Security

This app is not production-hardened. See `SECURITY.md` for vulnerability reporting. Contact: hello@yashura.music.
