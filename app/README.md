# Cue Clock: Mobile App

The React Native (Expo) application powering Cue Clock. Dual live clocks, infinite countdowns, on-air fullscreen mode, and per-timer alerts, built for broadcast studios where every second counts.

> Looking for the landing page? See [`../website/`](../website/README.md).
> Looking for the project overview? See the [root README](../README.md).

---

## Quick Start

No setup needed. Analytics, Firebase and signing are skipped when their settings are missing.

```bash
cd app
npm ci
npx expo start
```

Then press:

- `a`: run on Android emulator/device
- `i`: run on iOS simulator (macOS only)
- `w`: run in web browser

More setup details are in [`../DEVELOPMENT.md`](../DEVELOPMENT.md).

---

## Scripts

| Command                | What it does                        |
| ---------------------- | ----------------------------------- |
| `npx expo start`       | Start the Metro dev server          |
| `npx expo run:android` | Build + launch on connected Android |
| `npx expo run:ios`     | Build + launch on iOS simulator     |
| `npm run lint`         | Run ESLint                          |
| `npx tsc --noEmit`     | Type check                          |

---

## Tech Stack

| Layer         | Tech                                     |
| ------------- | ---------------------------------------- |
| Framework     | React Native 0.83 + Expo SDK 55          |
| Navigation    | Expo Router (file-based)                 |
| Language      | TypeScript 5.9 (strict)                  |
| Date/Time     | Luxon 3                                  |
| Persistence   | AsyncStorage                             |
| Notifications | @notifee/react-native (alarm + scheduling) + expo-notifications |
| Audio (alarm) | expo-audio (looped in-activity playback) |
| Vibration     | Local `expo-alarm-vibrator` native module (ALARM-class via AudioAttributes) |
| Analytics     | Microsoft Clarity (opt-in, GDPR consent) |

---

## Project Layout

```
app/
├── app/            # Expo Router screens (file-based routing)
│   ├── _layout.tsx # Root layout: fonts, stack, analytics init
│   └── index.tsx   # Main screen: all primary state lives here
├── components/     # UI components (ClockPicker, TargetBlock, modals)
├── constants/      # colors.ts, timezones.ts
├── hooks/          # Shared React hooks
├── lib/            # analytics.ts, alarms.ts, alarmHandlers.ts, debugLog.ts
├── modules/        # Local Expo modules (expo-alarm-vibrator)
├── assets/         # Icons, splash, fonts (SpaceMono), alarm.mp3
└── scripts/        # Maintenance utilities
```

For how the app works inside, see [`../CLAUDE.md`](../CLAUDE.md).

---

## Contributing

Issues and PRs are welcome! Read [`../CONTRIBUTING.md`](../CONTRIBUTING.md) before starting work.

## License

AGPL-3.0. See [`../LICENSE`](../LICENSE). Commercial licensing: [hello@yashura.io](mailto:hello@yashura.io).
