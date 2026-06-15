# Cue Clock Android: change a clock's timezone via the zone picker

## Setup

- Cue Clock (com.yanukadeneth99.cueclock) is installed and Metro is running with adb-reverse on :8081 (orchestrator handles both).
- The orchestrator resets app state immediately before this scenario, so the app launches FRESH: first-launch onboarding appears and the two clocks show their DEFAULTS — the top/zone-1 clock is Berlin (Europe/Berlin, green accent stripe) and the second/zone-2 clock is Colombo (Asia/Colombo, red accent stripe).
- This scenario tests the ZONE PICKER, the app's core multi-timezone feature. No cue is needed — the two clocks are always visible on the home screen.
- Zone-picker note: tapping a clock card opens a bottom-sheet picker with a "Search city or zone" field and a list of cities. Typing filters the list; tapping a city commits the change and closes the sheet. The currently-selected city has an accent dot on its row.

## Steps

1. Launch Cue Clock with open_app (--relaunch for cold start).
2. You might be greeted with an OS notification permission request. If so, press "Allow".
3. Dismiss onboarding
   1. Scroll down the "Android Setup" modal until you see the button "Continue", then press it.
   2. On the "Help improve Cue Clock" modal press "No thanks".
   3. Then on the "We'll miss your support" modal, complete the onboarding process by pressing "Opt out Anyway".
4. Once you reach the main home UI, confirm the two clock displays at the top: the zone-1 (green) clock reads "BERLIN" and the zone-2 (red) clock reads "COLOMBO".
5. Tap the zone-1 BERLIN clock card (the green one, at the top). The zone picker bottom-sheet must open, showing the "Search city or zone" field and a list of cities.
6. Type "Tok" into the search field. The list filters to the Tokyo entry (labelled "Tokyo" with the IANA id "Asia/Tokyo" beneath it).
7. Tap the "Tokyo" row. The picker commits the change and closes by itself.
8. Tap the "Colombo" row, and once the model opens, press on "Denver".
9. Snapshot and confirm the zone-1 clock card now reads "TOKYO" (no longer "BERLIN"), and its displayed time has changed to Tokyo's local time, and the zone-2 clock reads "DENVER".

## Expected

- The zone picker opened when the zone-1 and zon-2 clock was tapped.
- After picking Tokyo, the zone-1 clock shows "TOKYO" and its time updated; the zone-2 clock changed to "DENVER" and its time updated.
- No crash dialog, no red-screen RN error.

## Verdict

Pass iff tapping the zone-1 (Berlin) clock opened the zone picker, searching "Tokyo" and tapping its row changed the zone-1 clock to "TOKYO" with an updated time, AND the zone-2 clock changed to "DENVER". FAIL if the picker did not open, if the zone did not change to Tokyo or Denver, if the wrong clock changed, or if any crash / red-screen RN error is shown.
