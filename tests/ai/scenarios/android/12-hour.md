# Cue Clock Android: settings toggles visibly change the clock display to 12 hour clock

<!-- max-steps: 55 -->

## Setup

- Cue Clock (com.yanukadeneth99.cueclock) is installed and Metro is running with adb-reverse on :8081 (orchestrator handles both).
- The orchestrator resets app state immediately before this scenario, so the app launches FRESH: first-launch onboarding appears and settings are at their DEFAULTS — "24-hour clock" is ON and "Show seconds" is ON. So the two top clocks start in 24-hour format WITH seconds, e.g. "14:30:05" (no AM/PM, colon-separated hours:minutes:seconds).
- This scenario tests that two display toggles in Settings actually change the on-screen clocks (not just that the toggle flips). No cue is needed — the two clocks are always visible on the home screen.
- Settings note: open Settings with the gear (settings) icon in the top-right of the header. Each setting is a row you tap to toggle; the small pill on the right is the on/off switch. The Settings sheet is dismissed with the phone back button or its close (X) control.

## Steps

1. Launch Cue Clock with open_app (--relaunch for cold start).
2. You might be greeted with an OS notification permission request. If so, press "Allow".
3. Dismiss onboarding
   1. Scroll down the "Android Setup" modal until you see the button "Continue", then press it.
   2. On the "Help improve Cue Clock" modal press "No thanks".
   3. Then on the "We'll miss your support" modal, complete the onboarding process by pressing "Opt out Anyway".
4. Once you reach the main home UI, you should see two clock displays on the top and a pinned-bottom accent "Add a cue" button. The cue area in the middle MUST be empty.
5. Add the cue to edit (setup):
   1. Press the "Add a cue" button on the bottom of the screen.
   2. In the "Add a cue" modal, press "OK" (or the equivalent confirm button) in the OS time picker that opened automatically.
   3. Press the "NAME (OPTIONAL)" input field, type the name "Test Input". You might need to scroll down to see this field.
   4. Press the phone's back button to close the keyboard.
   5. Press "Add cue" at the bottom to save the new cue.
6. Confirm "Test Input" now appears as the primary "Up Next" card. The two zone timers above must show the time in 24-hour format.
7. Open Settings by pressing the gear (2nd icon from the right) icon in the top-right of the header.
8. Find the "24-hour clock" row and toggle it OFF (tap the row once).
9. Dismiss the Settings modal by pressing the X icon in the modal to return to the home UI.
10. Snapshot the two top clocks again and confirm the change took place. The zone times must show in 12 hour format now (ex: 2:30 PM) with the seconds number just below the AM/PM.

## Expected

- Before: clocks in 24-hour format with seconds (ex: "14:30:05").
- After toggling: clocks in 12-hour format with AM/PM with seconds (ex: "2:30:22 PM").
- No crash dialog, no red-screen RN error.

## Verdict

Pass iff the clocks started in 24-hour-with-seconds format, AND after turning "24-hour clock" OFF in Settings the home clocks visibly changed to 12-hour AM/PM format with seconds. FAIL if the change did not take effect on the displayed clocks, if Settings could not be opened or closed, or if any crash / red-screen RN error is shown.
