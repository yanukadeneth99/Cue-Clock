# Cue Clock web: edit a cue's time and name

## Setup

- The Expo web dev server is already running at http://localhost:8081 (the orchestrator boots it via boot-expo-web.sh before this scenario runs).
- This runs in a FRESH browser context (no persisted localStorage), so the app launches clean: the cue queue is empty and the first-launch analytics consent sheet appears.
- This scenario tests EDITING. Adding a cue first is setup, not the thing under test — but it must succeed for the edit to be possible.
- Naming note: the same modal is reused for adding and editing. When ADDING it is titled "Add a cue" with an "Add cue" save button; when EDITING it is titled "Edit cue" with a "Save changes" save button. All labels use sentence case — match on exact text rather than capitalization.
- Web time entry note: the web build has NO OS time picker. The target time renders as two editable digit fields (hour and minute) with up/down chevrons. To change the hour, click the hour field (it selects its contents on focus) and type a new two-digit value, or click its up/down chevron. There is no soft keyboard and no "OK" button to confirm the picker — the typed value is committed live into the field.

## Steps

1. Open http://localhost:8081 in the browser and wait for the Cue Clock UI to load.
2. Dismiss the first-launch analytics consent sheet by opting OUT (so test runs are NOT captured as real analytics): click "No thanks", then on the "We'll miss your support..." friction sheet that appears click "Opt Out Anyway" (NOT "Keep Supporting", which returns you to the consent sheet). If no consent sheet appears, proceed.
3. Add the cue to edit (setup):
   1. Click the circular accent "+" button in the top-right of the header to open the "Add a cue" modal.
   2. Click the "NAME (OPTIONAL)" input and type the name "Test Input". Leave the default time as-is.
   3. Click "Add cue" at the bottom to save the new cue.
4. Confirm "Test Input" now appears as the primary "Up Next" card. Note its currently displayed target time.
5. Edit the cue:
   1. Click the "Test Input" cue card (its name or countdown). It MUST open the "Edit cue" modal (title "Edit cue", "Save changes" footer) with the editable time fields and name input.
   2. Change the time to one hour later: read the current hour digit, add 1 (wrapping 23 → 00), click the hour field, and type that new two-digit value. Example: if the hour shows 20, set it to 21. Leave the minutes unchanged.
   3. Change the name from "Test Input" to "Production STB" in the name input.
   4. Click "Save changes" at the bottom of the modal to confirm the edits.
6. The modal closes and you return to the main screen.

## Expected

- The cue card opened in EDIT mode ("Edit cue" title, "Save changes" footer) when it was clicked.
- After saving, the cue card shows "Production STB" with the new (one-hour-later) target time and an increased countdown; the city is unchanged.
- No error toast, red banner, or red-screen RN error is visible.

## Visual

- Visual checks run AUTOMATICALLY after every step in this scenario — you do NOT need to call the `visual_check` tool yourself, and the harness FAILs the scenario on any HIGH defect at any checkpoint. The state that matters most is the home screen once the cue card shows "Production STB".
- The edited card must render cleanly: the new name "Production STB", the countdown, the target time, and the city label must each sit inside the card with no text truncated/ellipsized, no text overflowing the card or running off the right edge of the window, and no elements overlapping. "Production STB" is longer than the original name, so it is the realistic truncation/wrap risk — confirm it fits on the card without being cut off or ellipsized.
- The web build has no soft keyboard, but while the "Edit cue" modal is open the modal must not clip its own fields and must not hide the name input or time fields behind a sticky header or overlay; after the modal closes the home layout must settle with no leftover overlay, blank band, or misalignment.
- Treat a HIGH geometry finding (horizontal overflow past the viewport) on the card, a HIGH vision finding describing truncated/overflowing/overlapping card text, OR a HIGH vision finding of a field hidden behind an overlay or a layout gap/misalignment left after the modal closes, as a visual FAIL.

## Verdict

Pass iff clicking the cue card opened the "Edit cue" modal, the time was advanced by one hour, the name was changed to "Production STB", "Save changes" was clicked, and the cue card then showed "Production STB" with an increased countdown and the new target time while the city stayed the same. FAIL if the edit modal did not open, if the name or time did not update, if the city changed, or if any error toast / red-screen RN error is shown.
