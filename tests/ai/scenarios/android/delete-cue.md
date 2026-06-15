# Cue Clock Android: delete a cue with cancel-then-confirm

<!-- max-steps: 45 -->
<!-- WHY 45 (over the default 40): this scenario must first add a cue (the shared
     setup preamble) before the delete it actually tests, and the home screen's
     live ticking clock forces screenshot+press_xy fallbacks that cost extra steps.
     Onboarding (~6-8) + add (~12-15) + delete-with-cancel-then-confirm (~8-10)
     lands around 30-35; 45 leaves headroom without the runner killing the run. -->

## Setup

- Cue Clock (com.yanukadeneth99.cueclock) is installed and Metro is running with adb-reverse on :8081 (orchestrator handles both).
- The orchestrator resets app state immediately before this scenario, so the app launches FRESH: the cue queue is empty and first-launch onboarding appears. This scenario assumes that fresh state.
- This scenario tests DELETING, including that Cancel does NOT remove the cue. Adding a cue first is setup, not the thing under test — but it must succeed for the delete to be possible.
- Naming note (add): the pinned-bottom trigger button reads "Add a cue" and the modal it opens is also titled "Add a cue", but the modal's save button reads "Add cue" (no "a"). These are two different controls — do not confuse them.
- Delete note: pressing the trash icon opens a confirmation with "Cancel" and "Delete". "Cancel" must keep the cue; only "Delete" removes it.

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
6. Confirm "Test Input" now appears as the primary "Up Next" card.
7. Cancel a delete (the cue must survive):
   1. Press the red delete (trash) icon on the primary "Up Next" card. The confirmation opens.
   2. On the confirmation, press "Cancel". The dialog closes and NOTHING is deleted.
   3. OBSERVE ONLY — do NOT press anything: snapshot and confirm the "Test Input" cue is STILL present as the primary card. (Pressing "Cancel" never deletes; if the cue is still here, that is the expected result.)
8. Confirm a delete (the cue must be removed). The "Test Input" cue from step 7 is STILL present — this is a brand-new, second delete attempt:
   1. Press the red delete (trash) icon on the primary "Up Next" card AGAIN. This opens a FRESH confirmation (the same as step 7.1).
   2. On the confirmation, press "Delete" (NOT "Cancel").
   3. OBSERVE ONLY — do NOT press anything: take a final snapshot to confirm there are NO cues left. The cue disappearing HERE — after YOU pressed "Delete" in step 8.2 — is the CORRECT, expected outcome, NOT a Cancel failure.

> NOTE — attribute the deletion to the right press: the cue must only ever disappear right after a "Delete" press. Each trash press opens a fresh confirmation; "Cancel" closes it WITHOUT deleting, "Delete" removes the cue. If you pressed the trash a second time (step 8.1) and then "Delete" (step 8.2), the cue vanishing afterward is from THAT "Delete", not from the earlier "Cancel". Only report a Cancel failure if the cue disappears IMMEDIATELY after step 7.2's "Cancel" and BEFORE any further trash/Delete press.

## Expected

- Pressing the trash icon then "Cancel" left the cue in place.
- Pressing the trash icon again then "Delete" removed it, leaving the cue area empty with no errors.
- No crash dialog, no red-screen RN error.

## Visual

- Visual checks run AUTOMATICALLY after every action in this scenario — you do NOT call `visual_check` yourself, and the harness FAILs the scenario on any HIGH defect at any checkpoint. The state that matters most is while the "Test Input" cue is STILL present as a populated primary "Up Next" card (e.g. at step 7.3 after pressing "Cancel"); the post-delete empty state has no card to audit geometrically, so don't expect card findings there.
- The cue card must render cleanly: the name "Test Input", the countdown, the target time, the city label, and the red delete (trash) icon must each sit inside the card with no text truncated/ellipsized, no text overflowing the card or running off the screen edges, and no elements overlapping. The trash icon must not overlap the card's text.
- The keyboard interaction also matters here (during the add phase that creates the cue): while the name input is focused, the "Add a cue" modal must be pushed fully ABOVE the soft keyboard with the typing area visible (the input must NOT be hidden behind the keyboard), and after the keyboard closes the modal must settle back down with no blank space or layout gap at its bottom edge.
- Treat a HIGH geometry finding (horizontal overflow) on the card, a HIGH vision finding describing truncated/overflowing/overlapping card content, OR a HIGH vision finding of the name input being hidden behind the keyboard or a blank gap / misalignment left after the keyboard closes, as a visual FAIL.

## Verdict

Pass iff pressing the trash icon then "Cancel" left the cue in place, AND pressing the trash icon again then "Delete" removed it, leaving the cue area empty. The cue disappearing at the END (after the "Delete" press in step 8.2) is the EXPECTED success — do NOT misattribute that to the earlier "Cancel". A "Cancel" failure means the cue vanished IMMEDIATELY after step 7.2's "Cancel" and BEFORE any further trash/Delete press; if a second trash press (8.1) and a "Delete" (8.2) happened in between, the deletion is from that "Delete", which is correct. FAIL only if "Cancel" alone removed the cue, if "Delete" did not remove it, or if any crash / red-screen RN error is shown (including when the screen reaches the empty no-cues state).
