# Broadcast Clock

A minimal, distraction-free clock app built for broadcast professionals who need to monitor multiple timezones and track countdown timers simultaneously.

## What It Does

**Broadcast Clock** gives you two things on one screen:

1. **Dual timezone clocks** -- two live clocks side by side, each configurable to any of 8 common broadcast timezones.
2. **Countdown timers** -- create as many named countdowns as you need, each tied to a timezone and target time, with an optional deduction offset for pre-show buffer calculations.

There is also a **full-screen mode** that strips away all controls and shows only the clocks and countdowns -- designed for on-air display.

## Why

In live broadcast environments, every second counts. Operators need to glance at a screen and immediately know the time in multiple locations and how long until the next event. This app is built around that constraint: **fast, obvious, zero friction**.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo |
| Navigation | Expo Router (file-based) |
| Language | TypeScript (strict mode) |
| Styling | NativeWind / Tailwind CSS |
| Date/Time | Luxon |
| Persistence | AsyncStorage |

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npx expo start

# Run on a specific platform
npx expo run:android
npx expo run:ios
npx expo start --web
```

## Platforms

- iOS (including iPad)
- Android (edge-to-edge, adaptive icons)
- Web (via react-native-web)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request, and follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** -- see the [LICENSE](./LICENSE) file for full details.

**Commercial licensing:** If the AGPL does not work for your use case (proprietary deployment, SaaS without source disclosure, etc.), a commercial license is available. Contact [hello@yashura.music](mailto:hello@yashura.music) for more information.

## Security

See [SECURITY.md](./SECURITY.md) for how to report vulnerabilities.
