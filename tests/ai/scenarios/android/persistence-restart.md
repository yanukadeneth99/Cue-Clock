# Cue Clock Android: state survives an app restart

<!-- max-steps: 55 -->
<!-- WHY 55 (over the default 40): this scenario does a full add + a settings
     change, then a COLD RELAUNCH, then re-verifies three things. Onboarding
     (~6-8) + add (~12-15) + settings toggle (~5-7) + relaunch + verify (~8-12)
     lands around 35-42; 55 leaves headroom for the relaunch round-trip. -->

## Setup

- Cue Clock (com.yanukadeneth99.cueclock) is installed and Metro is running with adb-reverse on :8081 (orchestrator handles both).
- The orchestrator resets app state immediately before this scenario, so the app launches FRESH: first-launch onboarding appears, the cue queue is empty, and "24-hour clock" defaults ON (clocks show 24-hour time).
- This scenario tests PERSISTENCE: cues, settings, and the fact that onboarding was already completed must all survive a cold app restart (the app persists state to on-device storage and rehydrates it on launch). The relaunch in step 7 restarts the app WITHOUT clearing its data — that is the whole point.
- Naming note (add): the pinned-bottom trigger button reads "Add a cue" and the modal it opens is also titled "Add a cue", but the modal's save button reads "Add cue" (no "a"). These are two different controls — do not confuse them.

## Steps

1. Launch Cue Clock with open_app (it cold-starts the app automatically; no extra arguments needed).
2. You might be greeted with an OS notification permission request. If so, press "Allow".
3. Dismiss onboarding
   1. Scroll down the "Android setup" modal until you see the button "Continue", then press it.
   2. On the "Help improve Cue Clock" modal press "No thanks".
   3. Then on the follow-up modal, complete the onboarding by pressing "Opt Out Anyway".
4. Once you reach the main home UI (two clocks + pinned "Add a cue" button, empty cue area), add a cue:
   1. Press the "Add a cue" button at the bottom.
   2. In the "Add a cue" modal, press "OK" (or the equivalent confirm) in the OS time picker that opened automatically.
   3. Press the "NAME (OPTIONAL)" input, type the name "Persist me". You might need to scroll down to see this field.
   4. Press the phone back button to close the keyboard.
   5. Press "Add cue" to save. Confirm "Persist me" now appears as the primary "Up Next" card.
5. Open Settings via the gear (settings) icon in the top-right of the header.
6. Find the "24-hour clock" row and toggle it OFF (tap the row once), then dismiss the Settings sheet (phone back button or the close/X control). Confirm the home clocks now show 12-hour AM/PM time (e.g. "2:30 PM").
7. COLD RESTART the app: call the `restart_app` tool (with the same packageName). This force-stops and relaunches Cue Clock WITHOUT clearing its stored data — that is the whole point of the test. (Do NOT use `open_app` here: it refuses to relaunch an app that is already in the foreground, which it is at this step.)
8. After the app comes back up, snapshot and verify ALL THREE of the following:
   1. Onboarding does NOT appear again — the app goes straight to the home UI (because completing onboarding in step 3 was persisted).
   2. The "Persist me" cue is STILL present as the primary "Up Next" card.
   3. The clocks are STILL in 12-hour AM/PM format (the "24-hour clock" OFF setting persisted), not back to 24-hour.

## Expected

- After the cold relaunch the app lands directly on the home UI with no onboarding modals.
- "Persist me" is still the primary cue.
- The clocks are still 12-hour AM/PM (the toggled setting persisted).
- No crash dialog, no red-screen RN error.

## Verdict

Pass iff, after adding "Persist me" and turning "24-hour clock" OFF and then cold-relaunching the app, the app skips onboarding and lands on home, "Persist me" is still the primary cue, AND the clocks are still in 12-hour AM/PM format. FAIL if onboarding re-appeared, if the cue was lost, if the clock reverted to 24-hour, or if any crash / red-screen RN error is shown.
