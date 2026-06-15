# Cue Clock web: reset all clears cues, with cancel-then-confirm

## Setup

- The Expo web dev server is already running at http://localhost:8081 (the orchestrator boots it via boot-expo-web.sh before this scenario runs).
- This runs in a FRESH browser context (no persisted localStorage), so the app launches clean: the cue queue is empty and the first-launch analytics consent sheet appears.
- This scenario tests RESET ALL: that the "Reset all" button in Settings clears all cues, that Cancel does NOT clear anything, and that only confirming wipes state. Adding a cue first is setup, not the thing under test — but it must succeed for the reset to be observable.
- Add note: the "add a cue" control on web is the circular accent "+" button in the top-right of the header; the modal it opens is titled "Add a cue" and its save button reads "Add cue".
- Settings note: the gear (⚙) icon in the header opens the "Settings" sheet. The "Reset all" button is a red-outlined button near the bottom of that sheet.
- Reset note: clicking "Reset all" CLOSES the Settings sheet and opens a centered confirmation dialog titled "Reset All" with the message "This will clear all timers and settings. Are you sure?" and two buttons: "Cancel" (left) and "Yes, Reset" (right, in red). Clicking the dimmed backdrop outside the dialog also cancels. Only "Yes, Reset" clears state.

## Steps

1. Open http://localhost:8081 in the browser and wait for the Cue Clock UI to load.
2. Dismiss the first-launch analytics consent sheet by opting OUT (so test runs are NOT captured as real analytics): click "No thanks", then on the "We'll miss your support..." friction sheet that appears click "Opt Out Anyway" (NOT "Keep Supporting", which returns you to the consent sheet). If no consent sheet appears, proceed.
3. Add a cue to reset (setup):
   1. Click the circular accent "+" button in the top-right of the header to open the "Add a cue" modal.
   2. Click the "NAME (OPTIONAL)" input and type the name "Test Input". Leave the default time as-is.
   3. Click "Add cue" at the bottom to save the new cue.
4. Confirm "Test Input" now appears as the primary "Up Next" card.
5. Cancel a reset (the cue must survive):
   1. Click the gear (⚙) icon in the header to open the "Settings" sheet.
   2. Click the red "Reset all" button near the bottom of the Settings sheet.
   3. On the "Reset All" confirmation dialog, click "Cancel". The dialog closes and NOTHING is cleared.
   4. OBSERVE ONLY — do NOT click anything: read the screen and confirm the "Test Input" cue is STILL present as the primary card. (Clicking "Cancel" never clears; if the cue is still here, that is the expected result.)
6. Confirm a reset (the cue must be cleared). The "Test Input" cue from step 5 is STILL present — this is a brand-new, second reset attempt:
   1. Click the gear (⚙) icon in the header to open the "Settings" sheet again.
   2. Click the red "Reset all" button near the bottom of the Settings sheet.
   3. On the "Reset All" confirmation dialog, click "Yes, Reset" (the red button, NOT "Cancel").
   4. OBSERVE ONLY — do NOT click anything: confirm there are NO cues left (the cue area below the clocks is empty). The cue disappearing HERE — after YOU clicked "Yes, Reset" in step 6.3 — is the CORRECT, expected outcome, NOT a Cancel failure.

> NOTE — clocks are NOT cues: the two city-labeled cards at the TOP of the screen (e.g. "BERLIN (GMT+2)" and "COLOMBO (GMT+5:30)") are the permanent dual TIMEZONE CLOCKS — they are ALWAYS present and are NOT cues. The cue area is the region BELOW those clocks. "Empty cue area" means no cue cards below the clocks; the Berlin/Colombo clocks remaining is the correct, expected state, not leftover cues.

> NOTE — analytics consent must NOT reappear: reset preserves the analytics choice, so after "Yes, Reset" the app stays on the home UI and does NOT re-show the first-launch consent sheet. The consent sheet reappearing is a FAILURE.

## Expected

- Clicking "Reset all" then "Cancel" left the "Test Input" cue in place.
- Clicking "Reset all" again then "Yes, Reset" cleared it, leaving the cue area empty.
- The analytics consent sheet did NOT reappear after the reset (the consent choice is preserved).
- No error toast, red banner, or red-screen RN error is visible.

## Visual

- Visual checks run AUTOMATICALLY after every step in this scenario — you do NOT need to call the `visual_check` tool yourself, and the harness FAILs the scenario on any HIGH defect at any checkpoint. The state that matters most is the Settings sheet with the "Reset all" button visible, and the "Reset All" confirmation dialog; the post-reset empty state has no card to audit geometrically, so don't expect card findings there.
- The Settings sheet must render cleanly: its rows and the "Reset all" button must each sit inside the sheet with no text truncated/ellipsized, no text overflowing, and no elements overlapping.
- The "Reset All" confirmation dialog must render cleanly and centered: its title, message, and the "Cancel" / "Yes, Reset" buttons must fit inside the dialog without truncation, overflow, or overlap.
- Treat a HIGH geometry finding (horizontal overflow past the viewport), or a HIGH vision finding describing truncated/overflowing/overlapping sheet or dialog content, as a visual FAIL.

## Verdict

Pass iff clicking "Reset all" then "Cancel" left the cue in place, AND clicking "Reset all" again then "Yes, Reset" cleared it, leaving the cue area empty (the permanent BERLIN/COLOMBO timezone CLOCKS at the top are NOT cues — do not count them as remaining cues), AND the analytics consent sheet did NOT reappear after the reset. The cue disappearing at the END (after the "Yes, Reset" click in step 6.3) is the EXPECTED success — do NOT misattribute that to the earlier "Cancel". A "Cancel" failure means the cue vanished IMMEDIATELY after step 5.3's "Cancel" and BEFORE the second reset attempt. FAIL only if "Cancel" alone cleared the cue, if "Yes, Reset" did not clear it, if the consent sheet reappeared, or if any error toast / red-screen RN error is shown (including when the screen reaches the empty no-cues state).
