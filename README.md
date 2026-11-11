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

### 🚀 How releases work

- **Internal:** every merge to `master` builds the app and sends it to the Google Play Internal Testing track.
- **Beta:** publishing a GitHub pre-release by hand (tag `vX.Y.Z-beta.N`) sends a build to Open Testing.
- **Production:** turning that pre-release into a full release promotes the same tested build to Production, and the web app updates.

[![Android Internal](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-internal.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-internal.yml)
[![Android Beta](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-beta.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-beta.yml)
[![Android Promote](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-promote.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/android-promote.yml)
[![Web App Deploy](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/web-deploy.yml/badge.svg)](https://github.com/yanukadeneth99/Cue-Clock/actions/workflows/web-deploy.yml)

Release notes are written by hand.

---

### 🧪 Testing

Cue Clock is tested with [Maestro](https://maestro.mobile.dev) on a real Android phone. See [tests/maestro](./tests/maestro).

---

### 🛠️ Built with

<p>
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/GSAP-88CE02?style=for-the-badge&logo=greensock&logoColor=white" alt="GSAP" />
</p>

One repo, two products: the **app** (`app/`) and the marketing **site** (`website/`). Tests live in `tests/`.

> 🧑‍💻 **Want to run or self-host it?** Every setup step (install and platform builds) lives in **[DEVELOPMENT.md](./DEVELOPMENT.md)**.

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
**History** · [the retired AI pipeline experiment](./docs/ai-evals.md)

<img src="https://capsule-render.vercel.app/api?type=waving&color=60A5FA&height=80&section=footer" width="100%" alt="" />

</div>
