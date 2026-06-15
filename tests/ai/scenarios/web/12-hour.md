# Cue Clock web: a settings toggle visibly switches the clocks to 12-hour format

## Setup

- The Expo web dev server is already running at http://localhost:8081 (the orchestrator boots it via boot-expo-web.sh before this scenario runs).
- This runs in a FRESH browser context (no persisted localStorage), so settings are at their DEFAULTS: "24-hour clock" is ON and "Show seconds" is ON. The two top clocks therefore start in 24-hour format WITH seconds, e.g. "14:30:05" (no AM/PM, colon-separated hours:minutes:seconds). The first-launch analytics consent sheet appears on load.
- This scenario tests that a display toggle in Settings actually changes the on-screen clocks (not just that the toggle flips). No cue is needed — the two clocks are always visible on the home screen.
- Settings note: open Settings with the gear icon in the top-right of the header. The sheet is titled "Settings". Each setting is a row you click to toggle; the pill on the right is the on/off switch. There is no hardware back button on web — close the Settings sheet with the "×" (close) button in its top-right corner.

## Steps

1. Open http://localhost:8081 in the browser and wait for the Cue Clock UI to load.
2. Dismiss the first-launch analytics consent sheet by opting OUT (so test runs are NOT captured as real analytics): click "No thanks", then on the "We'll miss your support..." friction sheet that appears click "Opt Out Anyway" (NOT "Keep Supporting", which returns you to the consent sheet). If no consent sheet appears, proceed.
3. Confirm the two top clocks are in 24-hour format with seconds (e.g. "14:30:05" — no AM/PM).
4. Click the gear (Settings) icon in the top-right of the header. The "Settings" sheet opens.
5. Find the "24-hour clock" row and click it to toggle it OFF.
6. Close the Settings sheet by clicking the "×" (close) button in its top-right corner to return to the home UI.
7. Re-read the two top clocks and confirm the format changed: they now show 12-hour time with an AM/PM suffix (e.g. "2:30:05 PM").

## Expected

- Before: clocks in 24-hour format with seconds (e.g. "14:30:05").
- After toggling "24-hour clock" OFF: clocks in 12-hour format with AM/PM and seconds (e.g. "2:30:05 PM").
- No error toast, red banner, or red-screen RN error is visible.

## Verdict

Pass iff the clocks started in 24-hour-with-seconds format, AND after turning "24-hour clock" OFF in Settings the home clocks visibly changed to 12-hour AM/PM format. FAIL if the change did not take effect on the displayed clocks, if Settings could not be opened or closed, or if any error toast / red-screen RN error is shown.
