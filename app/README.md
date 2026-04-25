# Cue Clock: Mobile App

The React Native (Expo) application powering Cue Clock. Dual live clocks, infinite countdowns, on-air fullscreen mode, and per-timer alerts, built for broadcast studios where every second counts.

> Looking for the landing page? See [`../website/`](../website/README.md).
> Looking for the project overview? See the [root README](../README.md).

---

## Quick Start

**Zero setup required.** All optional features (analytics, Firebase, signing) gracefully skip initialization when their env vars are missing.

```bash
cd app
npm ci
npx expo start
```

Then press:

- `a`: run on Android emulator/device
- `i`: run on iOS simulator (macOS only)
- `w`: run in web browser

For a deeper setup guide (optional env vars, native builds, signing), see [`../DEVELOPMENT.md`](../DEVELOPMENT.md).

---

## Scripts

| Command                | What it does                        |
| ---------------------- | ----------------------------------- |
| `npx expo start`       | Start the Metro dev server          |
| `npx expo run:android` | Build + launch on connected Android |
| `npx expo run:ios`     | Build + launch on iOS simulator     |
| `npm run lint`         | Run ESLint                          |

---

## Tech Stack

| Layer         | Tech                                     |
| ------------- | ---------------------------------------- |
| Framework     | React Native 0.83 + Expo SDK 55          |
| Navigation    | Expo Router (file-based)                 |
| Language      | TypeScript 5.9 (strict)                  |
| Date/Time     | Luxon 3                                  |
| Persistence   | AsyncStorage                             |
| Notifications | expo-notifications                       |
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
├── lib/            # analytics.ts and other shared modules
├── assets/         # Icons, splash, fonts (SpaceMono)
└── scripts/        # Maintenance utilities
```

For the full architecture walkthrough (state model, countdown algorithm, alert queue, platform branches), see [`../CLAUDE.md`](../CLAUDE.md).

---

## 💛 Support

Cue Clock is free, open-source, and **will never have ads**. If it saves you time in the studio, consider supporting its development:

<a href="https://ko-fi.com/yanukadeneth99" target="_blank">
  <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support me on Ko-fi" height="36" />
</a>

---

## Contributing

Issues and PRs are welcome! Read [`../CONTRIBUTING.md`](../CONTRIBUTING.md) before starting work.

## License

AGPL-3.0. See [`../LICENSE`](../LICENSE). Commercial licensing: [hello@yashura.io](mailto:hello@yashura.io).
