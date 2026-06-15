# Cue Clock Android: enter and exit the fullscreen On-Air view

<!-- max-steps: 45 -->
<!-- WHY 45 (over the default 40): this scenario must first add a cue (the shared
     setup preamble) before the On-Air check it actually tests. The On-Air view has
     a live ticking clock that times out `snapshot`, forcing screenshot+press_xy
     fallbacks that cost extra steps. Onboarding (~6-8) + add (~12-15) +
     enter/verify/exit (~8-12) lands around 30-37; 45 leaves headroom. -->
<!-- end-state-present: Add a cue -->
<!-- WHY this gate: the EXIT here is the fragile bit. The "Exit full screen" pill
     is small, snapshot times out on the On-Air view so the agent taps via a
     vision-ESTIMATED press_xy, and a near-miss only re-arms the pill's dim timer
     (the surrounding full-screen Pressable's onPress is armDim, not onExit) — so
     the app silently stays fullscreen while the model happily finish(pass)es
     ("entered and exited"). Asserting the always-pinned "Add a cue" home button is
     on screen after the run mechanically catches that false pass: it's absent in
     the On-Air view, present only once we're truly back home. -->

## Setup

- Cue Clock (com.yanukadeneth99.cueclock) is installed and Metro is running with adb-reverse on :8081 (orchestrator handles both).
- The orchestrator resets app state immediately before this scenario, so the app launches FRESH: the cue queue is empty and first-launch onboarding appears. This scenario assumes that fresh state.
- This scenario tests the fullscreen (On-Air) view. Adding a cue first is setup, not the thing under test — but a cue must exist so the On-Air view has a hero countdown to display.
- Naming note (add): the pinned-bottom trigger button reads "Add a cue" and the modal it opens is also titled "Add a cue", but the modal's save button reads "Add cue" (no "a"). These are two different controls — do not confuse them.
- On-Air note: the On-Air view has a live ticking clock, so `snapshot` may time out there — prefer `screenshot` + `press_xy`. To EXIT the On-Air view, press the phone's hardware BACK button — it reliably returns to the home screen. (There is also an "Exit full screen" pill near the bottom, but it is small and auto-dims after ~3.5s, so back is the dependable exit.)

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
7. Verify the fullscreen (On-Air) view:
   1. Press the fullscreen icon in the top-right of the header to enter the On-Air view.
   2. The On-Air view has a live ticking clock, so `snapshot` may time out — prefer `screenshot` + `press_xy` here. Confirm the On-Air view shows the cue "Test Input" as the large hero countdown.
8. Exit the On-Air view by pressing the phone's hardware BACK button — this returns to the home screen reliably. (The on-screen "Exit full screen" pill also works but is small and may be auto-dimmed; back is preferred.)
9. Snapshot and confirm you are back on the normal home screen with the "Test Input" cue still present as the primary "Up Next" card.

## Expected

- The On-Air view opened and showed "Test Input" as the hero countdown.
- Exiting the On-Air view (hardware back) returned to the normal home screen with the cue still present.
- No crash dialog, no red-screen RN error.

## Visual

- Visual checks run AUTOMATICALLY after every action in this scenario — you do NOT call `visual_check` yourself, and the harness FAILs the scenario on any HIGH defect at any checkpoint. The state that matters most is the On-Air (fullscreen) view with "Test Input" as the large hero countdown (around step 7.2, before you exit).
- IMPORTANT: the On-Air view has a live ticking clock, so the deterministic geometry pass will likely report `GEOMETRY: unavailable` (the raw snapshot times out there, exactly like `snapshot`). That is EXPECTED on this screen and is NOT a failure — the vision pass carries the check here. Do not fail the scenario because geometry was unavailable.
- The hero layout must render cleanly: the cue name "Test Input" and the large hero countdown must fit on screen, not be clipped at the screen edges, not overlap each other, and not be cut off or ellipsized. The oversized hero font is BY DESIGN — only flag it if text is actually clipped, overflowing, or overlapping, not merely large.
- The keyboard interaction also matters earlier (during the add phase that creates the cue, before you enter fullscreen): while the name input is focused, the "Add a cue" modal must be pushed fully ABOVE the soft keyboard with the typing area visible (the input must NOT be hidden behind the keyboard), and after the keyboard closes the modal must settle back down with no blank space or layout gap at its bottom edge.
- Treat a HIGH vision finding describing the hero name or countdown being truncated, clipped at the screen edge, or overlapping another element, OR a HIGH vision finding (during the add phase) of the name input being hidden behind the keyboard or a blank gap / misalignment left after the keyboard closes, as a visual FAIL.

## Verdict

Pass iff the On-Air view opened showing "Test Input" as the hero countdown, and exiting it (hardware back) returned to the normal home screen with the cue still present as the primary "Up Next" card. FAIL if the On-Air view did not show the cue, if it could not be exited, if the cue was missing after exit, or if any crash / red-screen RN error is shown.
