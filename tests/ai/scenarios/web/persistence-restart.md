# Cue Clock web: state survives a page reload

## Setup

- The Expo web dev server is already running at http://localhost:8081 (the orchestrator boots it via boot-expo-web.sh before this scenario runs).
- This runs in a FRESH browser context (no persisted localStorage), so the app launches clean: the cue queue is empty, "24-hour clock" defaults ON, and the first-launch analytics consent sheet appears on load.
- This scenario tests PERSISTENCE: a cue, a settings change, and the answered consent prompt must all survive a page reload. The web build persists state to the browser's localStorage and rehydrates it on load. The reload in step 6 refreshes the SAME page in the SAME browser context (localStorage is preserved) — that is the whole point. Do NOT open a new incognito window or clear storage, which would wipe the state being tested.
- Add note: the "add a cue" control on web is the circular accent "+" button in the top-right of the header. Settings open via the gear icon; close the Settings sheet with its "×" (close) button (there is no hardware back button on web).

## Steps

1. Open http://localhost:8081 in the browser and wait for the Cue Clock UI to load.
2. On the first-launch analytics consent sheet, opt OUT (so test runs are NOT captured as real analytics): click "No thanks", then on the "We'll miss your support..." friction sheet that appears click "Opt Out Anyway" (NOT "Keep Supporting", which returns you to the consent sheet). Answering the prompt — either way — is what we expect to persist. If no consent sheet appears, proceed.
3. Add a cue:
   1. Click the circular accent "+" button in the top-right of the header to open the "Add a cue" modal.
   2. Click the "NAME (OPTIONAL)" input and type the name "Persist me". Leave the default time as-is.
   3. Click "Add cue" to save. Confirm "Persist me" now appears as the primary "Up Next" card.
4. Click the gear (Settings) icon to open the "Settings" sheet.
5. Find the "24-hour clock" row and click it to toggle it OFF, then close the Settings sheet with its "×" button. Confirm the home clocks now show 12-hour AM/PM time (e.g. "2:30 PM").
6. RELOAD the page: refresh http://localhost:8081 in the SAME browser tab (do not clear storage, do not open a new private window).
7. After the page reloads, verify ALL THREE of the following:
   1. The analytics consent sheet does NOT appear again — the app goes straight to the home UI (because answering it in step 2 was persisted).
   2. The "Persist me" cue is STILL present as the primary "Up Next" card.
   3. The clocks are STILL in 12-hour AM/PM format (the "24-hour clock" OFF setting persisted), not back to 24-hour.

## Expected

- After the reload the app lands directly on the home UI with no consent sheet.
- "Persist me" is still the primary cue.
- The clocks are still 12-hour AM/PM (the toggled setting persisted).
- No error toast, red banner, or red-screen RN error is visible.

## Verdict

Pass iff, after adding "Persist me" and turning "24-hour clock" OFF and then reloading the page, the app skips the consent sheet and lands on home, "Persist me" is still the primary cue, AND the clocks are still in 12-hour AM/PM format. FAIL if the consent sheet reappeared, if the cue was lost, if the clocks reverted to 24-hour, or if any error toast / red-screen RN error is shown.
