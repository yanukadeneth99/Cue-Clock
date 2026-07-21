# Cue Clock

**Time. Under Control.**

<img src="https://i.imgur.com/2C7aUM8.png" width="800">

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/yanukadeneth99/Cue-Clock)](https://github.com/yanukadeneth99/Cue-Clock/commits/master)
[![Made with Expo](https://img.shields.io/badge/Expo-SDK_55-000020?logo=expo)](https://expo.dev)
[![Sponsor](https://img.shields.io/github/sponsors/yanukadeneth99?logo=githubsponsors&label=Sponsor)](https://github.com/sponsors/yanukadeneth99)

[![Android Internal](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-internal.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-internal.yml)
[![Android Beta](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-beta.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-beta.yml)
[![Android Promote](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-promote.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-promote.yml)

A minimal, distraction-free clock app built specifically for broadcast professionals who need to monitor multiple timezones and track countdown timers simultaneously.

| Platform           | Link                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| 🌐 Live Site       | [cueclock.app](https://cueclock.app)                                                           |
| 🌐 Web Application | [live.cueclock.app](https://live.cueclock.app)                                                 |
| 📱 Android         | [Google Play Store](https://play.google.com/store/apps/details?id=com.yanukadeneth99.cueclock) |

---

## 💛 Support This Project

Cue Clock is **completely free, open-source, and ad-free**, and I plan to keep it that way.

> I will **never** place ads inside any product I build. If you find Cue Clock useful, consider buying me a coffee instead. It directly funds continued development, new features, and keeping the lights on.

<a href="https://ko-fi.com/yanukadeneth99" target="_blank">
  <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support me on Ko-fi" height="36" />
</a>

Every contribution, no matter the size, is genuinely appreciated. Thank you. 🙏

---

## ⚡ What it Does

In high-pressure broadcast environments, every second counts. **Cue Clock** is built for that constraint: **fast, obvious, and zero friction.**

- 🕒 **Dual Timezone Clocks:** Side-by-side live clocks configurable to 18 global broadcast timezones.
- ⏳ **Infinite Countdowns:** Create as many named countdowns as you need, tied to any timezone.
- 📐 **Deduction Offsets:** Subtract pre-show buffers automatically from your countdown targets.
- ✅ **Passed Cues:** Fired countdowns surface as compact strips so you always know what already aired.
- 🔔 **Alerts & Alarms:** Fire a notification, or a full-screen alarm that wakes the device, at a configurable lead time before zero (Android).
- 🔊 **Final 3-Second Beep:** Audio tick at T−3/−2/−1 and a "go" tone at zero for the primary cue (native).
- 🎬 **On-Air Mode:** A dedicated full-screen mode that strips away all controls for studio display.
- 📱 **Native Everywhere:** Optimized for iOS, Android, and Web with local state persistence.

---

## 🏗️ Project Structure

This is a monolithic codebase containing three main products:

### 1. The App (`app/`)

The core React Native (Expo SDK 55) application, the product itself. Runs on iOS, Android, and Web from one codebase.

**[Get Started with the App](./app/README.md)**

### 2. The Landing Page (`website/`)

A Next.js 16 marketing site at [cueclock.app](https://cueclock.app). Tailwind 4, GSAP animations, design tokens mirroring the app’s colour system.

**[Get Started with the Website](./website/README.md)**

### 3. AI E2E Tests (`tests/`)

Gemini-driven end-to-end test harness that exercises the real running app. Two runners share one plain-markdown scenario format: `web/` (Python, browser-use + Playwright against the Expo web build) and `android/` (TypeScript, LangChain.js + LangGraph driving a physical device via `agent-device`). Run from `app/` with `npm test`.

**[Test harness docs](./tests/ai/README.md)**

---

## 🤖 How the Automation Works

This repository largely runs itself. AI workflows triage issues, write code, review it, and draft releases, while a human presses the final Publish button. The diagram below shows the journey of a change from idea to real users.

```mermaid
flowchart LR
    A["You or a user reports a bug or idea as an issue"] --> B{"AI triage: is it clear and safe to build?"}
    X["Crashlytics detects a crash in the live app"] --> X2["Each morning, new crashes are filed as issues automatically"]
    X2 --> B
    W["Weekly AI scans hunt for bugs, removable code, and speed-ups, filing issues"] --> B
    B -- "No, or unclear" --> C["Waits for the maintainer with a question"]
    B -- "Yes" --> R["AI researches the issue and posts notes for the builder"]
    R --> D["AI writes the code and opens a pull request"]
    E["Dependabot suggests a library update"] --> F
    D --> F["The app is built and tested automatically"]
    F -- "Build fails" --> G["AI tries to repair it, up to 5 times"]
    G --> F
    F -- "Build passes" --> H{"A second AI reviews the change as a strict critic"}
    H -- "Rejected" --> G
    G -- "Out of attempts" --> C
    H -- "Approved" --> I["Merged automatically"]
    I --> J["A private test build goes to Google Play"]
    I --> K["AI drafts the beta release notes"]
    K --> L["Maintainer presses Publish: beta goes to public testers"]
    L --> M["AI drafts the production release notes"]
    M --> N["Maintainer presses Publish: the exact tested build reaches real users, and the web app updates"]
    C -- "daily summary of what needs a human" --> TG["Telegram message to the maintainer"]
    K -- "draft ready to review" --> TG
    M -- "draft ready to review" --> TG
```

---

## 📊 AI Evals

The automation is measured, not just trusted. A weekly job copies every AI comment and decision into [`data/ai-log/`](./data/ai-log/) as plain JSONL (a durable, machine-readable paper trail that can later be judged or used as training data), and a monthly job updates the scoreboard below.

<!-- AI-SCOREBOARD:START -->

The Score column is a 0 to 100 health mark made of three parts: how much of the AI's opened work was merged (50%), how much finished work needed no human rescue (30%), and how little automated repair churn the month took (20%). Higher is better, and a dash means the period was too quiet to score. A finished year collapses into a single summary row. Updated monthly by `.github/workflows/ai-evals.yml`.

| Period  | AI PRs opened | AI PRs merged | Auto-fix runs | Waiting on a human | Score /100 |
| ------- | ------------- | ------------- | ------------- | ------------------ | ---------- |
| 2026-07 | 7             | 4             | 17            | 2                  | 58         |

<!-- AI-SCOREBOARD:END -->

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yanukadeneth99/Cue-Clock.git
cd Cue-Clock

# Start the app (iOS / Android / Web)
cd app && npm install && npx expo start

# Start the landing page
cd ../website && npm install && npm run dev

# Run the AI E2E test suite (Gemini API key required, see tests/ai/README.md)
cd app && npm test          # web + physical Android device
cd app && npm run test:web  # web only
```

---

## 🛠️ Tech Stack

| Project     | Tech Stack                                                                         |
| ----------- | ---------------------------------------------------------------------------------- |
| **App**     | React Native, Expo, Luxon, TypeScript (strict), Expo Router, AsyncStorage          |
| **Website** | Next.js, Tailwind CSS, GSAP, TypeScript                                            |
| **Tests**   | Python (browser-use, Playwright), TypeScript (LangChain.js, LangGraph), Gemini API |

---

## 🤝 Contributing & License

We love contributions! Please read our [CONTRIBUTING.md](./CONTRIBUTING.md) and follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

Cue Clock is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. For commercial licensing, contact [hello@yashura.io](mailto:hello@yashura.io).

---

## 🛡️ Security

Found a vulnerability? See [SECURITY.md](./SECURITY.md) for reporting details.
