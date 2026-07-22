<div align="center">

<!-- Hero banner. capsule-render takes a single hex (no #); 60A5FA is Cue Clock's
     brand blue (app accent), so the banner matches the product, not my profile purple. -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=60A5FA&height=150&section=header&text=CUE%20CLOCK&fontSize=62&fontColor=ffffff&fontAlignY=40&animation=fadeIn" width="100%" alt="Cue Clock" />

### Time. Under Control.

<!-- Animated tagline. Space Mono on purpose: the app renders every clock/countdown
     digit in Space Mono, so the banner font echoes the product's numeric identity. -->
<a href="https://cueclock.app">
  <img src="https://readme-typing-svg.demolab.com?font=Space+Mono&weight=700&size=21&duration=2800&pause=900&color=60A5FA&center=true&vCenter=true&width=760&lines=Dual+clocks.+Infinite+countdowns.;Built+for+broadcast.+Zero+friction.;Offline-first.+Free.+Open-source.;Wakes+the+device+the+moment+it+matters." alt="Tagline" />
</a>

<p>
  <a href="https://cueclock.app"><img src="https://img.shields.io/badge/%F0%9F%8C%90%20Website-60A5FA?style=for-the-badge" alt="Website" /></a>
  <a href="https://live.cueclock.app"><img src="https://img.shields.io/badge/%E2%9A%A1%20Launch%20App-252830?style=for-the-badge" alt="Web App" /></a>
  <a href="https://play.google.com/store/apps/details?id=com.yanukadeneth99.cueclock"><img src="https://img.shields.io/badge/Google%20Play-Download-34A853?style=for-the-badge&logo=googleplay&logoColor=white" alt="Google Play" /></a>
  <a href="https://ko-fi.com/yanukadeneth99"><img src="https://img.shields.io/badge/%E2%98%95%20Buy%20me%20a%20coffee-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Buy me a coffee" /></a>
</p>

<img src="https://i.imgur.com/2C7aUM8.png" width="820" alt="Cue Clock screenshot" />

</div>

A minimal, distraction-free clock built for **broadcast professionals** who watch multiple timezones and run countdown timers at once. Read from across a studio; fast, obvious, and zero friction when every second counts.

---

### ⚡ What it does

|                                                                                       |                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 🕒 **Dual Timezone Clocks:** side-by-side live clocks across 18 broadcast timezones. | ⏳ **Infinite Countdowns:** as many named timers as you need, tied to any zone. |
| 📐 **Deduction Offsets:** auto-subtract pre-show buffers from targets.               | ✅ **Passed Cues:** fired countdowns collapse into compact strips.              |
| 🔔 **Alerts & Alarms:** a notification, or a full-screen alarm that wakes the device (Android). | 🔊 **Final 3-Second Beep:** audio ticks at T−3/−2/−1 and a "go" tone at zero. |
| 🎬 **On-Air Mode:** a full-screen studio display with every control stripped away.   | 📱 **Native Everywhere:** iOS, Android & Web from one codebase, offline-first.  |

---

### 🤖 It largely runs itself

This repo is a working demo of an **autonomous software pipeline**. AI workflows triage issues, research them, write the code, review it as a strict critic, and draft releases; a human only presses the final **Publish**. The AI workflows that run it:

[![Issue Triage](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-issue-decider.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-issue-decider.yml)
[![Issue Researcher](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-issue-researcher.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-issue-researcher.yml)
[![Implementer](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-implementer.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-implementer.yml)
[![CI Auto Fixer](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-ci-auto-fix.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-ci-auto-fix.yml)
[![PR Review](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-pr-decider.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-pr-decider.yml)
[![Weekly Bug Scan](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-weekly-bug-scan.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-weekly-bug-scan.yml)
[![Weekly Optimizer](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-weekly-optimizer.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-weekly-optimizer.yml)
[![Weekly Minimizer](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-weekly-minimizer.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-weekly-minimizer.yml)
[![Weekly Sonar Scan](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-weekly-sonar-scan.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-weekly-sonar-scan.yml)
[![Crash to Issue](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/crash-to-issue.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/crash-to-issue.yml)
[![Daily Digest](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-daily-digest.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/claude-daily-digest.yml)

```mermaid
flowchart LR
    A["You or a user reports a bug or idea as an issue"] --> B{"AI triage: is it clear and safe to build?"}
    X["Crashlytics detects a crash in the live app"] --> X2["Each morning, new crashes are filed as issues automatically"]
    X2 --> B
    W["Weekly AI scans hunt for bugs, removable code, speed-ups, and code-quality problems, filing issues"] --> B
    B -- "No, or unclear" --> C["Waits for the maintainer with a question"]
    B -- "Yes" --> R["AI researches the issue and posts notes for the builder"]
    R --> D["AI writes the code and opens a pull request"]
    E["Dependabot suggests a library update"] --> F
    D --> F["The app is built and tested automatically"]
    F -- "Build fails" --> G["AI tries to repair it, up to 5 times"]
    G --> F
    F -- "Build passes" --> Q["A code-quality gate checks the pull request"]
    Q -- "Quality issue found" --> G
    Q -- "Looks clean" --> H{"A second AI reviews the change as a strict critic"}
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

<!-- AI-SCOREBOARD:START -->

**📊 AI Evals.** The automation is measured, not just trusted. Score is a 0-100 health mark: work merged (50%), work that needed no human rescue (30%), and low repair churn (20%). A dash means too quiet to score. Updated monthly by `.github/workflows/ai-evals.yml`.

| Period  | AI PRs opened | AI PRs merged | Auto-fix runs | Waiting on a human | Score /100 |
| ------- | ------------- | ------------- | ------------- | ------------------ | ---------- |
| 2026-07 | 7             | 4             | 17            | 2                  | 58         |

<!-- AI-SCOREBOARD:END -->

---

### 🚀 Release pipeline

Once a change is merged, shipping is automated too. These build and deploy the app to Google Play and the web:

[![Android Internal](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-internal.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-internal.yml)
[![Android Beta](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-beta.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-beta.yml)
[![Android Promote](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-promote.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-promote.yml)
[![Web App Deploy](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/web-deploy.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/web-deploy.yml)

---

### 🛠️ Built with

<p>
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/GSAP-88CE02?style=for-the-badge&logo=greensock&logoColor=white" alt="GSAP" />
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini" />
  <img src="https://img.shields.io/badge/Claude-D97757?style=for-the-badge&logo=claude&logoColor=white" alt="Claude" />
</p>

One monorepo, three products: the **app** (`app/`), the marketing **site** (`website/`), and an AI-driven **E2E test harness** (`tests/`).

> 🧑‍💻 **Want to run or self-host it?** Every setup step (install, platform builds, the test suite) lives in **[DEVELOPMENT.md](./DEVELOPMENT.md)**.

---

### 💛 Support

Cue Clock is **free, open-source, and ad-free**, and it will stay that way. I will never put ads in anything I build. If it's useful to you, a coffee funds continued development.

<a href="https://ko-fi.com/yanukadeneth99">
  <img src="https://img.shields.io/badge/%E2%98%95%20Buy%20me%20a%20coffee-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Support on Ko-fi" height="40" />
</a>

---

<div align="center">

**License** · [AGPL-3.0](./LICENSE) · commercial licensing: [hello@yashura.io](mailto:hello@yashura.io)  
**Contributing** · [CONTRIBUTING.md](./CONTRIBUTING.md) · [Code of Conduct](./CODE_OF_CONDUCT.md)  
**Security** · found a vulnerability? [SECURITY.md](./SECURITY.md)

<img src="https://capsule-render.vercel.app/api?type=waving&color=60A5FA&height=80&section=footer" width="100%" alt="" />

</div>
