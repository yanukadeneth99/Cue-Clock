# Cue Clock web: opt out of analytics during the first-launch consent flow

## Setup

- The Expo web dev server is already running at http://localhost:8081 (the orchestrator boots it via boot-expo-web.sh before this scenario runs).
- This runs in a FRESH browser context (no persisted localStorage), so the first-launch analytics consent sheet appears on load. This scenario assumes that fresh state. (If the consent sheet does not appear because storage was somehow persisted, you may instead drive the same path via the Settings gear → "Turn off analytics" — both flows route through the same opt-out sheet.)
- This scenario is web-specific: on Android the consent step is part of the onboarding wizard, but on web the consent sheet is the entire first-launch gauntlet.
- Flow note: the consent sheet offers "Allow analytics" (accent) and "No thanks" (muted). Clicking "No thanks" does NOT immediately opt you out — it opens a second, friction-heavy sheet titled "We'll miss your support..." with "Keep Supporting" (accent — this re-routes you BACK to the consent sheet) and "Opt Out Anyway" (muted — this actually completes the opt-out). In the consent-origin path this second sheet is non-dismissable via a backdrop click.

## Steps

1. Open http://localhost:8081 in the browser and wait for the analytics consent sheet to appear.
2. The consent sheet has a heading mentioning analytics / "help improve" and two choices: "Allow analytics" (accent) and "No thanks" (muted). Click "No thanks".
3. The friction sheet "We'll miss your support..." appears. Click "Opt Out Anyway" to complete the opt-out (do NOT click "Keep Supporting" — that returns you to the consent sheet).
4. Both sheets close and you return to the main Cue Clock UI.
5. Observe the header: with analytics OFF, a small animated accent "diamond" nudge icon appears in the top-right icon row (just to the LEFT of the Help "?" icon), inviting you to re-enable analytics.

## Expected

- After opting out you are returned to the main UI (the two clocks are visible).
- The header shows the analytics-off nudge: a small animated accent diamond beside the Help "?" icon (its accessibility label is "Enable analytics"). This glyph is the unique signal that analytics is currently disabled — it does NOT appear when analytics is enabled or still un-asked.
- No error toast, red banner, or red-screen RN error is visible.

## Verdict

Pass iff the opt-out flow completed (clicking "No thanks" then "Opt Out Anyway" dismissed both sheets in sequence) AND the header analytics-off nudge diamond is visible afterwards. FAIL if the flow could not be completed, if "Opt Out Anyway" did not return you to the home UI, or if no nudge diamond appears.
