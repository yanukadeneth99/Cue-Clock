# Cue Clock Android: edit a cue's time and name

<!-- max-steps: 50 -->
<!-- WHY 45 (over the default 40): this scenario must first add a cue (the shared
     setup preamble) before the edit it actually tests, and the home screen's live
     ticking clock forces screenshot+press_xy fallbacks that cost extra steps.
     Onboarding (~6-8) + add (~12-15) + edit-and-verify (~8-10) lands around 30-35;
     45 leaves headroom without the runner killing the run mid-edit. -->

## Setup

- Cue Clock (com.yanukadeneth99.cueclock) is installed and Metro is running with adb-reverse on :8081 (orchestrator handles both).
- The orchestrator resets app state immediately before this scenario, so the app launches FRESH: the cue queue is empty and first-launch onboarding appears. This scenario assumes that fresh state.
- This scenario tests EDITING. Adding a cue first is setup, not the thing under test — but it must succeed for the edit to be possible.
- Naming note (add): the pinned-bottom trigger button reads "Add a cue" and the modal it opens is also titled "Add a cue", but the modal's save button reads "Add cue" (no "a"). These are two different controls — do not confuse them.
- Naming note (edit): the same modal is reused for editing, but the title then reads "Edit cue" and the save button reads "Save changes". All labels use sentence case, so match on exact text rather than capitalization.

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
7. Edit the cue:
   1. Press the main countdown timer in the middle of the primary "Up Next" card. It MUST open the "Edit cue" modal with the OS time picker on top.
   2. Change the time to one hour more than the current displayed time. The OS time picker opens as a CLOCK DIAL whose hour/minute digits are display-only and NOT tappable — do NOT tap the numbers or scroll the dial (those taps do nothing, and a stale/repeated tap can hit the system nav bar and exit the app). Instead: (a) press the "Switch to text input mode for the time input." button to turn the picker into editable Hour/Minute text fields; (b) take the current hour, add 1 (wrapping 23→00), and `fill` the Hour field with that new two-digit value; (c) the `fill` raises the soft keyboard, which COVERS the OK button at the bottom of the dialog — press the phone's back button ONCE to dismiss the keyboard, re-snapshot, THEN press "OK" to confirm (pressing OK with the keyboard still up taps the keyboard, not OK). Example: if it shows 20:00, set the hour to 21.
   3. Change the name of the cue from "Test Input" to "Production STB". You might need to scroll down to see this field.
   4. Press the "Save changes" button at the bottom of the modal to confirm the changes.
8. Snapshot and ensure the following in the primary "Up Next" card: the name was changed to "Production STB", the countdown timer has increased, the target time was changed, the city is still the same.

## Expected

- The primary card opened in EDIT mode ("Edit cue" title, "Save changes" footer) when its countdown was tapped.
- After saving, the primary card shows "Production STB" with an increased countdown, the new target time, and the same city.
- No crash dialog, no red-screen RN error.

## Visual

- Visual checks run AUTOMATICALLY after every action in this scenario — you do NOT call `visual_check` yourself, and the harness FAILs the scenario on any HIGH defect at any checkpoint. The state that matters most here is the home screen once the primary "Up Next" card shows "Production STB".
- The edited card must render cleanly: the new name "Production STB", the countdown, the target time, and the city label must each sit inside the card with no text truncated/ellipsized, no text overflowing the card or running off the screen edges, and no elements overlapping. "Production STB" is a longer name than the original, so it is the realistic truncation/wrap risk — confirm it fits on the card without being cut off or ellipsized.
- The keyboard interaction also matters here: while the name input is focused, the cue modal must be pushed fully ABOVE the soft keyboard with the typing area visible (the input must NOT be hidden behind the keyboard), and after the keyboard closes the modal must settle back down with no blank space or layout gap at its bottom edge.
- Treat a HIGH geometry finding (horizontal overflow) on the card, a HIGH vision finding describing truncated/overflowing/overlapping card text, OR a HIGH vision finding of the name input being hidden behind the keyboard or a blank gap / misalignment left after the keyboard closes, as a visual FAIL.

## Verdict

Pass iff tapping the countdown opened the "Edit cue" modal with the time picker, the time was advanced by one hour, the name was changed to "Production STB", "Save changes" was pressed, and the primary card then showed "Production STB" with an increased countdown, the new target time, and the same city. FAIL if the edit modal did not open, if the name or time did not update, if the city changed, or if any crash / red-screen RN error is shown.
