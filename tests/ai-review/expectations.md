# What each screen should show

Cue Clock is a clock app for broadcast staff. It shows two time zone clocks at the top and a list of countdown timers ("cues") below. All data in the screenshots is test data. The screenshot file name starts with the test name and the step, for example `edit-cue-02-modal-open.png`.

## Every screen

- Dark theme only. The page is near black (#0a0b0e), panels are dark grey (#1a1d23), cards on top are a slightly lighter grey (#252830).
- Blue (#60a5fa) is for main buttons and the brand dot.
- Amber (#fbbf24) appears only on a countdown that is getting close, an alert bell, or an alarm. Amber anywhere else is an issue.
- Red (#ef4444) appears only on a countdown in its last minute and on delete or reset buttons. Red anywhere else is an issue. The small red dot on the second clock and green dot on the first clock are fine.
- All numbers (clocks, countdowns, times) are in a monospace font (Space Mono) with even digit widths. Other text is in Inter.
- The countdown on the main card is the largest, most visible thing on screen.
- No text is cut off, clipped, overlapping other text, or hidden under the keyboard or off the edge of the screen. A long cue name may end with "…", that is fine.
- Nothing looks broken: no blank white areas, no missing icons shown as boxes, no error messages, no debug overlays.

## Screens by step

- `*-01-first-run`: the home screen after first-run dialogs were closed. Header "Cue Clock" with icon buttons, two clock cards side by side (default Berlin and Colombo), no cues yet. On Android a wide blue "add cue" button sits at the bottom; on web a round blue "+" sits in the header. No dialog is open.
- `add-cue-02-modal-open`, `cue-buffer-02-modal-open`, `cue-passes-02-modal-open`: the "Add a cue" form is open with Target time, Zone, Buffer, Alert before and Name fields, and an "Add cue" button.
- `cue-buffer-02-modal-open`: the Buffer field shows 01:00.
- `edit-cue-02-modal-open`: the "Edit cue" form is open with a Delete button and a "Save changes" button. The keyboard may be open on Android; the name field must not be hidden under it.
- `delete-cue-02-confirm`: a small "Delete cue?" dialog with Cancel and a red Delete button.
- `settings-02-modal-open`: the Settings sheet with "24-hour clock" and "Show seconds" both switched off.
- `second-zone-02-modal-open`: the zone picker with a search box containing "Asia/Tok" and a Tokyo row in the list.
- `add-cue-03-done`, `edit-cue-03-done`, `cue-buffer-03-done`, `cue-passes-03-counting`: the home screen with one "Up Next" card showing the cue name, a large countdown, and a Target / City row. Names used: "Maestro Test Cue" or "Playwright Test Cue", "Renamed Cue", "Buffer Cue", "Passing Cue". The buffer card also shows "Buffer −01:00".
- `delete-cue-03-done`: the home screen with no cues.
- `settings-03-done`: the two clocks show AM or PM and no seconds.
- `second-zone-03-done`: the second clock card shows Tokyo instead of Colombo.
- `cue-passes-04-passed`: a small dimmed "PASSED" strip with "Passing Cue" above where the cards would be.
- `test-failed-*` (web only): a screenshot taken when a test failed. Describe what looks wrong.
