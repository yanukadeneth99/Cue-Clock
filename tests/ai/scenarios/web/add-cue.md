# Cue Clock web: add a cue to verify cue creation in the desktop layout

## Setup

- The Expo web dev server is already running at http://localhost:8081 (the orchestrator boots it via boot-expo-web.sh before this scenario runs).
- This runs in a FRESH browser context (no persisted localStorage), so the app launches clean: the cue queue is empty and the first-launch analytics consent sheet appears. This scenario assumes that fresh state.
- Web vs. mobile note: on the web build the "add a cue" control is a small circular accent "+" button in the TOP-RIGHT of the header (to the LEFT of the Help "?", Settings gear, and Full screen icons) — there is NO pinned-bottom "Add a cue" button like the phone app has. The modal it opens is titled "Add a cue" and its save button reads "Add cue" (no "a"). These are two different controls — do not confuse them.
- Web time entry note: the web build has NO OS time picker. Inside the modal the target time renders as two editable digit fields (hour and minute) separated by a colon, each with up/down chevrons. You do not need to change the time for this scenario — the default is fine.

## Steps

1. Open http://localhost:8081 in the browser and wait for the Cue Clock UI to load.
2. Dismiss the first-launch analytics consent sheet by opting OUT (so test runs are NOT captured as real analytics): click "No thanks", then on the "We'll miss your support..." friction sheet that appears click "Opt Out Anyway" (NOT "Keep Supporting", which returns you to the consent sheet). If no consent sheet appears, proceed.
3. Confirm you are on the main home UI: a top header with the "Cue Clock" wordmark and the right-hand icon row, two clock displays below it (the "Clock Rail"), and an empty cue area in the middle.
4. Click the circular accent "+" button in the top-right of the header. The "Add a cue" modal opens.
5. Click the "NAME (OPTIONAL)" name input (placeholder "e.g. Show open") and type the name "Test Input".
6. Click the "Add cue" button at the bottom of the modal to save the new cue.
7. The modal closes and you return to the main screen.

## Expected

- Because the queue started empty, the cue just added is the ONLY cue, so it appears as the primary "Up Next" card showing the name "Test Input" along with the countdown timer, the target time, the city, and the delete control.
- No error toast, red banner, or red-screen RN error is visible.

## Visual

- Visual checks run AUTOMATICALLY after every step in this scenario — you do NOT need to call the `visual_check` tool yourself, and the harness FAILs the scenario on any HIGH defect at any checkpoint. The state that matters most is the main screen once the "Test Input" cue is the primary "Up Next" card (after the modal closes).
- The page must render cleanly at the current window size: the cue name "Test Input", its countdown, target time and city, the two clock-rail displays, and the header controls must each sit inside their container with no text truncated/ellipsized, nothing overflowing its card or running off the right edge of the window, and no elements overlapping. The cue column is a centered ~60%-width band on desktop; its card content must stay inside that band. "Test Input" is short and MUST NOT be cut off or wrapped onto a second line.
- The web build has no soft keyboard, but a sticky/fixed header, toast, or the modal itself must never hide focused or primary content — if the cue card or clock content is occluded by an overlay, that is a defect.
- Treat a HIGH geometry finding (horizontal overflow past the viewport, ellipsized/clipped truncation) on the cue or clock content, or a HIGH vision finding describing truncated/overflowing/overlapping content or content hidden behind an overlay, as a visual FAIL.

## Verdict

Pass iff the "Add a cue" modal opened from the header "+" button, "Test Input" was typed into the name input, the "Add cue" button was clicked, the modal closed, AND "Test Input" is visible on the main screen afterwards (as the primary "Up Next" card). FAIL if the cue was not created, if the name did not appear, or if any error toast / red-screen RN error is shown.
