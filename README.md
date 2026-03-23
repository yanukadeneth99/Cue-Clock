# Cue Clock

**Time. Under Control.**

A minimal, distraction-free clock app built specifically for broadcast professionals who need to monitor multiple timezones and track countdown timers simultaneously.

---

## ⚡ What it Does

In high-pressure broadcast environments, every second counts. **Cue Clock** is built for that constraint: **fast, obvious, and zero friction.**

- 🕒 **Dual Timezone Clocks** — Side-by-side live clocks configurable to 18 global broadcast timezones.
- ⏳ **Infinite Countdowns** — Create as many named countdowns as you need, tied to any timezone.
- 📐 **Deduction Offsets** — Subtract pre-show buffers automatically from your countdown targets.
- 🎬 **On-Air Mode** — A dedicated full-screen mode that strips away all controls for studio display.
- 📱 **Native Everywhere** — Optimized for iOS, Android, and Web with local state persistence.

---

## 🏗️ Project Structure

This is a monolithic codebase containing two main projects:

### 1. The Mobile App (`app/`)
The core React Native (Expo) application. It handles the clock logic, state persistence, and native notifications.

**[Get Started with the App](./app/README.md)**

### 2. The Landing Page (`website/`)
A modern Next.js 15 landing page showcasing Cue Clock’s features and design.

**[Get Started with the Website](./website/README.md)**

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yanukadeneth99/Cue-Clock.git
cd Cue-Clock

# Start the Mobile App
cd app && npm install && npx expo start

# Start the Website
cd ../website && npm install && npm run dev
```

---

## 🛠️ Tech Stack

| Project | Tech Stack |
|---|---|
| **Mobile App** | React Native, Expo, Luxon, TypeScript, Reanimated, AsyncStorage |
| **Website** | Next.js 15, Tailwind CSS 4, TypeScript |

---

## 🤝 Contributing & License

We love contributions! Please read our [CONTRIBUTING.md](./CONTRIBUTING.md) and follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

Cue Clock is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. For commercial licensing, contact [hello@yashura.music](mailto:hello@yashura.music).

---

## 🛡️ Security

Found a vulnerability? See [SECURITY.md](./SECURITY.md) for reporting details.
