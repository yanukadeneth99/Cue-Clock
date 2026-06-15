# Cue Clock Android: reset all clears cues, with cancel-then-confirm

<!-- max-steps: 50 -->
<!-- WHY 50 (over the default 40): this scenario must first add a cue (the shared
     setup preamble) before the reset it actually tests, then open Settings twice
     (cancel-then-confirm). Onboarding (~6-8) + add (~12-15) + reset-with-cancel-
     then-confirm (~12-15) lands around 35-40; 50 leaves headroom without the
     runner killing the run. -->

## Setup

- Cue Clock (com.yanukadeneth99.cueclock) is installed and Metro is running with adb-reverse on :8081 (orchestrator handles both).
- The orchestrator resets app state immediately before this scenario, so the app launches FRESH: the cue queue is empty and first-launch onboarding appears. This scenario assumes that fresh state.
- This scenario tests RESET ALL: that the "Reset all" button in Settings clears all cues, that Cancel does NOT clear anything, and that only confirming wipes state. Adding a cue first is setup, not the thing under test — but it must succeed for the reset to be observable.
- Naming note (add): the pinned-bottom trigger button reads "Add a cue" and the modal it opens is also titled "Add a cue", but the modal's save button reads "Add cue" (no "a"). These are two different controls — do not confuse them.
- Settings note: the gear (⚙) icon in the header opens the "Settings" sheet. The "Reset all" button is a red-outlined button near the bottom of that sheet (you may need to scroll the sheet down to reach it).
- Reset note: pressing "Reset all" CLOSES the Settings sheet and opens a confirmation dialog titled "Reset All" with the message "This will clear all timers and settings. Are you sure?" and two buttons: "Cancel" and "Yes, Reset". Only "Yes, Reset" clears state.

## Steps

1. Launch Cue Clock with open_app (--relaunch for cold start).
2. You might be greeted with an OS notification permission request. If so, press "Allow".
3. Dismiss onboarding
   1. Scroll down the "Android Setup" modal until you see the button "Continue", then press it.
   2. On the "Help improve Cue Clock" modal press "No thanks".
   3. Then on the "We'll miss your support" modal, complete the onboarding process by pressing "Opt out Anyway".
4. Once you reach the main home UI, you should see two clock displays on the top and a pinned-bottom accent "Add a cue" button. The cue area in the middle MUST be empty.
5. Add the cue to reset (setup):
   1. Press the "Add a cue" button on the bottom of the screen.
   2. In the "Add a cue" modal, press "OK" (or the equivalent confirm button) in the OS time picker that opened automatically.
   3. Press the "NAME (OPTIONAL)" input field, type the name "Test Input". You might need to scroll down to see this field.
   4. Press the phone's back button to close the keyboard.
   5. Press "Add cue" at the bottom to save the new cue.
6. Confirm "Test Input" now appears as the primary "Up Next" card.
7. Cancel a reset (the cue must survive):
   1. Press the gear (⚙) icon in the header to open the "Settings" sheet.
   2. Scroll the Settings sheet down until the red "Reset all" button is visible, then press it.
   3. On the "Reset All" confirmation dialog, press "Cancel". The dialog closes and NOTHING is cleared.
   4. OBSERVE ONLY — do NOT press anything: snapshot and confirm the "Test Input" cue is STILL present as the primary card. (Pressing "Cancel" never clears; if the cue is still here, that is the expected result.)
8. Confirm a reset (the cue must be cleared). The "Test Input" cue from step 7 is STILL present — this is a brand-new, second reset attempt:
   1. Press the gear (⚙) icon in the header to open the "Settings" sheet again.
   2. Scroll the Settings sheet down until the red "Reset all" button is visible, then press it.
   3. On the "Reset All" confirmation dialog, press "Yes, Reset" (NOT "Cancel").
   4. OBSERVE ONLY — do NOT press anything: take a final snapshot to confirm there are NO cues left (the cue area is empty). The cue disappearing HERE — after YOU pressed "Yes, Reset" in step 8.3 — is the CORRECT, expected outcome, NOT a Cancel failure.

> NOTE — onboarding must NOT reappear: reset preserves the analytics choice, so after "Yes, Reset" the app stays on the home UI and does NOT re-show the first-launch onboarding/consent. Onboarding reappearing is a FAILURE.

## Expected

- Pressing "Reset all" then "Cancel" left the "Test Input" cue in place.
- Pressing "Reset all" again then "Yes, Reset" cleared it, leaving the cue area empty.
- The onboarding/consent flow did NOT reappear after the reset (the consent choice is preserved).
- No crash dialog, no red-screen RN error.

## Visual

- Visual checks run AUTOMATICALLY after every action in this scenario — you do NOT call `visual_check` yourself, and the harness FAILs the scenario on any HIGH defect at any checkpoint. The state that matters most is the Settings sheet with the "Reset all" button visible, and the cue card while it is still present; the post-reset empty state has no card to audit geometrically, so don't expect card findings there.
- The Settings sheet must render cleanly: its rows and the "Reset all" button must each sit inside the sheet with no text truncated/ellipsized, no text overflowing the screen edges, and no elements overlapping.
- The keyboard interaction also matters here (during the add phase that creates the cue): while the name input is focused, the "Add a cue" modal must be pushed fully ABOVE the soft keyboard with the typing area visible, and after the keyboard closes the modal must settle back down with no blank space or layout gap at its bottom edge.
- Treat a HIGH geometry finding (horizontal overflow), a HIGH vision finding describing truncated/overflowing/overlapping sheet or card content, OR a HIGH vision finding of the name input being hidden behind the keyboard or a blank gap left after the keyboard closes, as a visual FAIL.

## Verdict

Pass iff pressing "Reset all" then "Cancel" left the cue in place, AND pressing "Reset all" again then "Yes, Reset" cleared it, leaving the cue area empty, AND the onboarding/consent flow did NOT reappear after the reset. The cue disappearing at the END (after the "Yes, Reset" press in step 8.3) is the EXPECTED success — do NOT misattribute that to the earlier "Cancel". A "Cancel" failure means the cue vanished IMMEDIATELY after step 7.3's "Cancel" and BEFORE the second reset attempt. FAIL only if "Cancel" alone cleared the cue, if "Yes, Reset" did not clear it, if onboarding reappeared, or if any crash / red-screen RN error is shown (including when the screen reaches the empty no-cues state).
