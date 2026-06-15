# Cue Clock web: delete a cue with cancel-then-confirm

## Setup

- The Expo web dev server is already running at http://localhost:8081 (the orchestrator boots it via boot-expo-web.sh before this scenario runs).
- This runs in a FRESH browser context (no persisted localStorage), so the app launches clean: the cue queue is empty and the first-launch analytics consent sheet appears.
- This scenario tests DELETING, including that Cancel does NOT remove the cue. Adding a cue first is setup, not the thing under test — but it must succeed for the delete to be possible.
- Add note: the "add a cue" control on web is the circular accent "+" button in the top-right of the header; the modal it opens is titled "Add a cue" and its save button reads "Add cue".
- Delete note: the cue card has a delete (trash) control. Clicking it opens a centered confirmation dialog titled "Delete cue?" with the message `Remove "Test Input" permanently? This can't be undone.` and two buttons: "Cancel" (left) and "Delete" (right, in red). "Cancel" must keep the cue; only "Delete" removes it. Clicking the dimmed backdrop outside the dialog also cancels.

## Steps

1. Open http://localhost:8081 in the browser and wait for the Cue Clock UI to load.
2. Dismiss the first-launch analytics consent sheet by opting OUT (so test runs are NOT captured as real analytics): click "No thanks", then on the "We'll miss your support..." friction sheet that appears click "Opt Out Anyway" (NOT "Keep Supporting", which returns you to the consent sheet). If no consent sheet appears, proceed.
3. Add the cue to delete (setup):
   1. Click the circular accent "+" button in the top-right of the header to open the "Add a cue" modal.
   2. Click the "NAME (OPTIONAL)" input and type the name "Test Input". Leave the default time as-is.
   3. Click "Add cue" at the bottom to save the new cue.
4. Confirm "Test Input" now appears as the primary "Up Next" card.
5. Cancel a delete (the cue must survive):
   1. Click the delete (trash) control on the "Test Input" cue card. The "Delete cue?" dialog opens.
   2. On the "Delete cue?" confirmation dialog, click "Cancel". The dialog closes and NOTHING is deleted.
   3. OBSERVE ONLY — do NOT click anything in this sub-step: just read the screen and confirm the "Test Input" cue is STILL present as the primary card. (Clicking "Cancel" never deletes; if the cue is still here, that is the expected result.)
6. Confirm a delete (the cue must be removed). The "Test Input" cue from step 5 is STILL present — this is a brand-new, second delete attempt:
   1. Click the delete (trash) control on the "Test Input" cue card AGAIN. This opens a FRESH "Delete cue?" dialog (the same as step 5.1).
   2. On the "Delete cue?" confirmation dialog, click "Delete" (the red button, NOT "Cancel").
   3. OBSERVE ONLY — do NOT click anything: confirm there are NO cues left (the cue area below the clocks is empty). The cue disappearing HERE — after YOU clicked "Delete" in step 6.2 — is the CORRECT, expected outcome, NOT a Cancel failure.

> NOTE — attribute the deletion to the right click: the cue must only ever disappear right after a "Delete" click. Each trash click opens a fresh dialog; "Cancel" closes it WITHOUT deleting, "Delete" removes the cue. If you clicked the trash a second time (step 6.1) and then "Delete" (step 6.2), the cue vanishing afterward is from THAT "Delete", not from the earlier "Cancel". Only report a Cancel failure if the cue disappears IMMEDIATELY after step 5.2's "Cancel" and BEFORE any further trash/Delete click.

> NOTE — clocks are NOT cues: the two city-labeled cards at the TOP of the screen (e.g. "BERLIN (GMT+2)" and "COLOMBO (GMT+5:30)") are the permanent dual TIMEZONE CLOCKS — they are ALWAYS present and are NOT cues. The cue area is the region BELOW those clocks. "Empty cue area" means no cue cards below the clocks; the Berlin/Colombo clocks remaining is the correct, expected state, not leftover cues.

## Expected

- Clicking the trash control then "Cancel" left the cue in place.
- Clicking the trash control again then "Delete" removed it, leaving the cue area empty with no errors.
- No error toast, red banner, or red-screen RN error is visible.

## Visual

- Visual checks run AUTOMATICALLY after every step in this scenario — you do NOT need to call the `visual_check` tool yourself, and the harness FAILs the scenario on any HIGH defect at any checkpoint. The state that matters most is while the "Test Input" cue is STILL present as a populated primary "Up Next" card (e.g. at step 5.3 after clicking "Cancel"); the post-delete empty state has no card to audit geometrically, so don't expect card findings there.
- The cue card must render cleanly: the name "Test Input", the countdown, the target time, the city label, and the delete (trash) control must each sit inside the card with no text truncated/ellipsized, no text overflowing the card or running off the right edge of the window, and no elements overlapping. The trash control must not overlap the card's text.
- The "Delete cue?" confirmation dialog must render cleanly and centered: its title, message, and the "Cancel" / "Delete" buttons must fit inside the dialog without truncation, overflow, or overlap.
- Treat a HIGH geometry finding (horizontal overflow past the viewport) on the card, or a HIGH vision finding describing truncated/overflowing/overlapping card or dialog content, as a visual FAIL.

## Verdict

Pass iff clicking the trash control then "Cancel" left the cue in place, AND clicking the trash control again then "Delete" removed it, leaving the cue area empty. The two permanent city-labeled TIMEZONE CLOCKS at the top (e.g. "BERLIN", "COLOMBO") are NOT cues — do NOT count them as remaining cues; the cue area is empty when no cue cards sit below those clocks. The cue disappearing at the END (after the "Delete" click in step 6.2) is the EXPECTED success — do NOT misattribute that to the earlier "Cancel". A "Cancel" failure means the cue vanished IMMEDIATELY after step 5.2's "Cancel" and BEFORE any further trash/Delete click; if a second trash click (6.1) and a "Delete" (6.2) happened in between, the deletion is from that "Delete", which is correct. FAIL only if "Cancel" alone removed the cue, if "Delete" did not remove it, or if any error toast / red-screen RN error is shown (including when the screen reaches the empty no-cues state).
