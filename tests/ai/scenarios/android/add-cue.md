# Cue Clock Android: add a cue to verify cue creation and keyboard handling

## Setup

- Cue Clock (com.yanukadeneth99.cueclock) is installed and Metro is running with adb-reverse on :8081 (orchestrator handles both).
- The orchestrator resets app state immediately before this scenario, so the app launches FRESH: the cue queue is empty and first-launch onboarding appears. This scenario assumes that fresh state.
- Naming note: the pinned-bottom trigger button reads "Add a cue" and the modal it opens is also titled "Add a cue", but the modal's save button reads "Add cue" (no "a"). These are two different controls — do not confuse them.

## Steps

1. Launch Cue Clock with open_app (--relaunch for cold start).
2. You might be greeted with an OS notification permission request. If so, press "Allow".
3. Dismiss onboarding
   1. Scroll down the "Android Setup" modal until you see the button "Continue", then press it.
   2. On the "Help improve Cue Clock" modal press "No thanks".
   3. Then on the "We'll miss your support" modal, complete the onboarding process by pressing "Opt out Anyway".
4. Once you reach the main home UI, you should see two clock displays on the top and a pinned-bottom accent "Add a cue" button. The cue area in the middle MUST be empty.
5. Press the "Add a cue" button on the bottom of the screen.
6. The "Add a cue" modal opens, and the OS time picker opens automatically on top of it. Create the cue in the following order:
   1. Press "OK" (or the equivalent confirm button) in the OS time picker.
   2. Press the "NAME (OPTIONAL)" input field to open the keyboard and allow typing. You might need to scroll down before seeing this input field.
   3. Type the name "Test Input".
   4. Press the phone's back button to close the keyboard.
   5. Press "Add cue" at the bottom to save the new cue.
7. The modal closes and you return to the main screen.
8. Take a snapshot to confirm the cue was added.

## Expected

- Because the queue started empty, the cue just added MUST be the ONLY cue, so it appears as the primary "Up Next" card showing the name "Test Input", along with the countdown timer, target time, city, and the red delete (trash) icon.
- The modal moved up when the keyboard opened and settled back down when it closed, with no residue or blank space.
- No crash dialog, no red-screen RN error.

## Visual

- Visual checks run AUTOMATICALLY after every action in this scenario — you do NOT call `visual_check` yourself, and the harness FAILs the scenario on any HIGH defect at any checkpoint. The state that matters most here is the home screen once the new "Test Input" cue is the primary "Up Next" card.
- The cue card must render cleanly: the name "Test Input", the countdown, the target time, and the city label must each sit inside the card with no text truncated/ellipsized, no text overflowing the card or running off the screen edges, and no elements overlapping. The name "Test Input" is short and MUST NOT be cut off or wrapped.
- The keyboard interaction also matters here: while the name input is focused, the "Add a cue" modal must be pushed fully ABOVE the soft keyboard with the typing area visible (the input must NOT be hidden behind the keyboard), and after the keyboard closes the modal must settle back down with no blank space or layout gap at its bottom edge.
- Treat a HIGH geometry finding (horizontal overflow) on the card, a HIGH vision finding describing truncated/overflowing/overlapping card text, OR a HIGH vision finding of the name input being hidden behind the keyboard or a blank gap / misalignment left after the keyboard closes, as a visual FAIL.

## Verdict

Pass iff the "Add a cue" modal opened, "Test Input" was typed into the name input, the modal moved up and back down correctly as the keyboard opened and closed (no residue or blank space), "Add cue" was pressed, the modal closed, and "Test Input" appeared as the primary "Up Next" card. FAIL if the cue was not created, if the name did not appear on the card, if the modal left any residue or blank space during keyboard entry or dismissal, or if any crash / red-screen RN error is shown.
