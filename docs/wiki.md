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
  - [Alerts](#alerts)
  - [On-Air (Full-Screen) Mode](#on-air-full-screen-mode)
  - [12 / 24-Hour Format](#12--24-hour-format)
  - [Resetting the App](#resetting-the-app)
  - [Supported Timezones](#supported-timezones)
  - [Platform Notes](#platform-notes)

---

## Getting Started

Download Cue Clock from the [Google Play Store](https://play.google.com/store/apps/details?id=com.yanukadeneth99.cueclock) or visit [cueclock.app](https://cueclock.app) to use it in your browser.

On first launch you will be asked whether to allow anonymous analytics. This is optional and can be changed at any time via the **?** help button.

---

## Live Clocks

Two large clocks sit at the top of the screen, each independently configurable to any of the 18 supported broadcast timezones.

- Tap the **timezone label** beneath either clock to open the picker and choose a zone.
- Both clocks update every second in real time.
- Clock 1 is displayed in **green**; Clock 2 in **red**, matching broadcast convention for primary/secondary feeds.

---

## Countdown Timers

Each countdown card shows the time remaining until a target moment in a chosen timezone.

### Adding a timer

- **Mobile:** tap the **+ Add** button in the footer.
- **Web:** click the **+ Add** button in the header.

### Configuring a timer

| Field           | Description                                              |
| --------------- | -------------------------------------------------------- |
| **Name**        | Label for this countdown (e.g. "Live Show", "Ad Break"). |
| **Target time** | The clock time you are counting down to (HH:MM).         |
| **Timezone**    | The timezone the target time is expressed in.            |
| **Deduction**   | An offset subtracted from the target (see below).        |

- If the target time has already passed today, the countdown automatically rolls over to the same time **tomorrow**.
- Tap the **collapse arrow** (▼) on a card to minimise it and save screen space.
- Tap the **trash icon** to delete a timer (you will be asked to confirm).

---

## Deduction Offsets

A deduction lets you subtract a buffer from the target time.

**Example:** Your show airs at 20:00 but you need to be ready 15 minutes early. Set target = `20:00` and deduction = `00:15`. The countdown will show time remaining until `19:45`.

This is useful for pre-show prep, satellite uplink windows, or any fixed lead-time before the actual event.

---

## Alerts

Each countdown can trigger an alert a set number of minutes before it reaches zero.

1. Tap the **bell icon** on a countdown card.
2. Enter how many minutes before the target you want to be notified.
3. Tap **Set Alert**.

When the countdown reaches that threshold (at exactly `HH:MM:00`), you will receive:

- A push notification (mobile, if permission is granted).
- An in-app alert banner.

The alert fires once and is then automatically cleared from the card.

**Android note:** Background notifications require the app to have "Background Activity" permission. A step-by-step guide is accessible from the help screen if needed.

---

## On-Air (Full-Screen) Mode

Full-screen mode strips away all controls for a clean studio display.

- **Mobile:** tap the **broadcast icon** in the footer.
- **Web:** click the **broadcast icon** in the header.

In full-screen mode:

- The countdown font scales dynamically: the more timers you have, the smaller each one gets to fit the screen.
- An **exit button** appears at the bottom edge and auto-dims after 3 seconds. Tap anywhere on it to exit.

---

## 12 / 24-Hour Format

Toggle between 12-hour (AM/PM) and 24-hour display from the **?** help screen.

- Affects the **live clocks** and the **target time** shown on each countdown card.
- Countdown durations (HH:MM:SS) always use 24-hour style regardless of this setting.
- The preference is saved and restored across sessions.

---

## Resetting the App

To clear all timers and settings, open the **?** help screen and tap **Reset**. You will be asked to confirm.

> Analytics consent is **preserved** on reset; you will not be asked again.

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

| Feature            | Mobile (iOS / Android)          | Web                              |
| ------------------ | ------------------------------- | -------------------------------- |
| Push notifications | ✅                              | ✅ (browser permission required) |
| Full-screen mode   | ✅                              | ✅                               |
| Background timers  | ✅ (with permission on Android) | Depends on tab visibility        |
| Persistent storage | AsyncStorage                    | AsyncStorage (localStorage)      |

---

_Cue Clock is open-source under the [AGPL-3.0 license](../LICENSE). For support or commercial licensing contact hello@yashura.io._
