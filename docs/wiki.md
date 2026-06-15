# Cue Clock: User Guide

**Cue Clock** is a time management tool built for broadcast professionals. It lets you monitor multiple timezones and run precision countdown timers, all in one distraction-free display.

---

## Table of Contents

- [Cue Clock: User Guide](#cue-clock-user-guide)
  - [Table of Contents](#table-of-contents)
  - [Getting Started](#getting-started)
  - [Live Clocks](#live-clocks)
  - [Countdown Timers](#countdown-timers)
    - [Adding a timer](#adding-a-timer)
    - [Configuring a timer](#configuring-a-timer)
  - [Deduction Offsets](#deduction-offsets)
  - [Passed Cues](#passed-cues)
  - [Alerts](#alerts)
  - [Final 3-Second Beep](#final-3-second-beep)
  - [On-Air (Full-Screen) Mode](#on-air-full-screen-mode)
  - [Settings](#settings)
  - [Resetting the App](#resetting-the-app)
  - [Analytics](#analytics)
  - [Supported Timezones](#supported-timezones)
  - [Platform Notes](#platform-notes)

---

## Getting Started

Download Cue Clock from the [Google Play Store](https://play.google.com/store/apps/details?id=com.yanukadeneth99.cueclock) or visit [cueclock.app](https://cueclock.app) to use it in your browser.

On first launch you will be asked whether to allow anonymous analytics. This is optional and can be changed at any time via **Settings** (the ⚙ gear icon in the header). On Android, a step-by-step onboarding guide for background permissions appears before the analytics prompt.

---

## Live Clocks

Two large clocks sit at the top of the screen, each independently configurable to any of the 18 supported broadcast timezones.

- Tap the **timezone label** beneath either clock to open the picker and choose a zone.
- Both clocks update every second in real time.
- Clock 1 is displayed in **green**; Clock 2 in **red**, matching broadcast convention for primary/secondary feeds.

---

## Countdown Timers

Each countdown card shows the time remaining until a target moment in a chosen timezone. Cards are sorted by time remaining (soonest first) and update every second.

### Adding a timer

- **Mobile:** tap the **+ Add** button in the footer.
- **Web:** click the **+** button in the header.

### Configuring a timer

Tap a countdown card to open the edit sheet.

| Field           | Description                                              |
| --------------- | -------------------------------------------------------- |
| **Name**        | Label for this countdown (e.g. "Live Show", "Ad Break"). |
| **Target time** | The clock time you are counting down to (HH:MM).         |
| **Timezone**    | The timezone the target time is expressed in.            |
| **Deduction**   | An offset subtracted from the target (see below).        |
| **Alert**       | How many minutes before zero to fire an alert.           |

- If the target time has already passed today, the countdown automatically rolls over to the same time **tomorrow**.
- Tap the **trash icon** inside the edit sheet to delete a timer.

---

## Deduction Offsets

A deduction lets you subtract a buffer from the target time.

**Example:** Your show airs at 20:00 but you need to be ready 15 minutes early. Set target = `20:00` and deduction = `00:15`. The countdown will show time remaining until `19:45`.

This is useful for pre-show prep, satellite uplink windows, or any fixed lead-time before the actual event.

---

## Passed Cues

When a countdown reaches zero it becomes a **passed cue**. Passed cues appear as compact strips above the primary countdown card, showing how long ago they fired.

- Passed cues are detected automatically — no manual dismissal is required to move to the next cue.
- Tap **×** on a passed-cue strip to dismiss it for that day. It will reappear the next day when the countdown rolls over.
- All passed cues reset at midnight in Clock 1's timezone.
- Use the **Auto-minimize passed cues** toggle in Settings to show or hide the strip. Turning it off freezes the display; turning it back on restores the live state immediately.

---

## Alerts

Each countdown can trigger an alert a set number of minutes before it reaches zero. Configure alerts inside the countdown's edit sheet (tap the card to open it) under the **Alert Before** section.

When the countdown reaches the configured threshold (at exactly `HH:MM:00`), you will receive:

- A push notification (mobile, if permission is granted).
- An in-app alert banner.

**Android — Alarm mode:** On Android the alert can be promoted to a full **Alarm**: a full-screen intent that wakes the device over the lock screen, plays a looping alarm sound, and vibrates at ALARM priority (audible even when "Vibrate on Tap" is disabled). Choose between **Alarm** and **Notification** mode inside the alert configuration. The alert fires once at the scheduled threshold and then clears automatically.

**Snooze:** After an alert fires you can snooze it; snooze is available an unlimited number of times.

**Background notifications (Android):** Background alerts require "Background Activity" permission. A step-by-step guide is accessible via the onboarding wizard (first launch) or by tapping the help option inside the **?** icon in Settings.

---

## Final 3-Second Beep

*(Native mobile only — not available on web.)*

When enabled, the **primary** countdown (the top card) plays a short audio cue in its final 3 seconds:

- A short 880 Hz tick fires at T−3, T−2, and T−1 seconds.
- A longer 1320 Hz tone fires at exactly T=0 ("go").

Enable or disable this from **Settings** → **Final beep**. The setting is saved across sessions.

---

## On-Air (Full-Screen) Mode

Full-screen mode strips away all controls for a clean studio display.

- **Mobile:** tap the **broadcast icon** in the footer.
- **Web:** click the **broadcast icon** in the header.

In full-screen mode:

- Only active (non-passed) cues are shown, sorted by time remaining.
- The countdown font scales dynamically: the more timers you have, the smaller each one gets to fit the screen.
- An **exit button** appears at the bottom edge and auto-dims after 3 seconds. Tap anywhere on it to exit.

---

## Settings

Tap the **⚙ gear icon** in the header to open Settings. Available options:

| Setting                      | Description                                                                 |
| ---------------------------- | --------------------------------------------------------------------------- |
| **24-hour clock**            | Toggle between 12-hour (AM/PM) and 24-hour display for the live clocks and target times. Countdown durations (HH:MM:SS) always use 24-hour style. |
| **Show seconds**             | Show or hide the seconds field on the live clocks.                          |
| **Auto-minimize passed cues**| When on (default), cues that have fired appear as compact strips above the primary card. When off, the strip is hidden. |
| **Final beep**               | (Native only) Enable the 3-second audio cue on the primary countdown (see above). |
| **Keep screen on**           | Prevent the device from sleeping while the app is in the foreground.        |
| **Analytics**                | Opt out of (or back into) anonymous analytics at any time.                  |

All preferences are saved and restored across sessions. **Reset** (see below) preserves your analytics choice.

---

## Resetting the App

To clear all timers and settings, open **Settings** (⚙) and tap **Reset**. You will be asked to confirm.

> Analytics consent is **preserved** on reset; you will not be asked again.

---

## Analytics

Cue Clock collects anonymous usage data (screens visited, device type, crash reports, performance metrics, and general geographic region) via Microsoft Clarity and Firebase. No personal data is captured.

- You are asked to opt in on first launch. Declining has no effect on app functionality.
- If you opted out and change your mind, an **accent-coloured diamond (◆)** indicator appears in the header as a gentle nudge. Tap it, or open **Settings → Analytics**, to re-enable at any time.
- To opt out after previously accepting, open **Settings → Analytics** and tap **Opt out**. A confirmation sheet appears before the choice is finalised.

---

## Supported Timezones

Cue Clock includes 18 broadcast-industry timezones:

| Label              | Zone                           |
| ------------------ | ------------------------------ |
| UTC                | UTC                            |
| ET (New York)      | America/New_York               |
| CT (Chicago)       | America/Chicago                |
| MT (Denver)        | America/Denver                 |
| PT (Los Angeles)   | America/Los_Angeles            |
| GMT (London)       | Europe/London                  |
| CET (Paris)        | Europe/Paris                   |
| EET (Helsinki)     | Europe/Helsinki                |
| MSK (Moscow)       | Europe/Moscow                  |
| GST (Dubai)        | Asia/Dubai                     |
| IST (Mumbai)       | Asia/Kolkata                   |
| CST (Shanghai)     | Asia/Shanghai                  |
| JST (Tokyo)        | Asia/Tokyo                     |
| AEST (Sydney)      | Australia/Sydney               |
| NZST (Auckland)    | Pacific/Auckland               |
| BRT (São Paulo)    | America/Sao_Paulo              |
| ART (Buenos Aires) | America/Argentina/Buenos_Aires |
| CAT (Johannesburg) | Africa/Johannesburg            |

---

## Platform Notes

| Feature                    | Mobile (iOS / Android)                     | Web                              |
| -------------------------- | ------------------------------------------ | -------------------------------- |
| Push notifications         | ✅                                         | ✅ (browser permission required) |
| Alarm mode (full-screen)   | ✅ Android only                            | ❌                               |
| Final 3-second beep        | ✅                                         | ❌                               |
| Full-screen / On-Air mode  | ✅                                         | ✅                               |
| Background timers          | ✅ (with permission on Android)            | Depends on tab visibility        |
| Persistent storage         | AsyncStorage                               | AsyncStorage (localStorage)      |
| Keep screen on             | ✅                                         | ❌                               |

---

_Cue Clock is open-source under the [AGPL-3.0 license](../LICENSE). For support or commercial licensing contact hello@yashura.io._
