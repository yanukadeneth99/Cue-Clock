# Cue Clock web: change both clock-rail timezones via the zone picker

## Setup

- The Expo web dev server is already running at http://localhost:8081 (the orchestrator boots it via boot-expo-web.sh before this scenario runs).
- This runs in a FRESH browser context (no persisted localStorage), so the two clocks show their DEFAULTS: the zone-1 clock (green accent) is Berlin (Europe/Berlin) and the zone-2 clock (red accent) is Colombo (Asia/Colombo). The first-launch analytics consent sheet appears on load.
- This scenario tests the ZONE PICKER, the app's core multi-timezone feature. No cue is needed — the two clocks are always visible on the home screen. The city labels render in UPPERCASE (e.g. "BERLIN", "COLOMBO", "TOKYO", "DENVER").
- Zone-picker note: clicking a clock card opens a bottom-sheet picker titled "Zone 1" (for the green clock) or "Zone 2" (for the red clock), with a "Search city or zone" field and a list of cities. Typing filters the list; clicking a city commits the change and closes the sheet. The currently-selected city row has an accent dot.

## Steps

1. Open http://localhost:8081 in the browser and wait for the Cue Clock UI to load.
2. Dismiss the first-launch analytics consent sheet by opting OUT (so test runs are NOT captured as real analytics): click "No thanks", then on the "We'll miss your support..." friction sheet that appears click "Opt Out Anyway" (NOT "Keep Supporting", which returns you to the consent sheet). If no consent sheet appears, proceed.
3. Confirm the two clock displays: the zone-1 (green) clock reads "BERLIN" and the zone-2 (red) clock reads "COLOMBO".
4. Click the zone-1 BERLIN clock card (the green one). The zone picker ("Zone 1") must open, showing the "Search city or zone" field and a list of cities.
5. Type "Tok" into the search field. The list filters to the Tokyo entry (labelled "Tokyo" with the IANA id "Asia/Tokyo" beneath it).
6. Click the "Tokyo" row. The picker commits the change and closes by itself.
7. Click the zone-2 COLOMBO clock card (the red one) to open the "Zone 2" picker, type "Denver" into the search field, and click the "Denver" row. The picker closes by itself.
8. Confirm the zone-1 clock card now reads "TOKYO" (no longer "BERLIN") with an updated local time, and the zone-2 clock now reads "DENVER" (no longer "COLOMBO") with an updated local time.

## Expected

- The zone picker opened when each clock card was clicked, titled "Zone 1" then "Zone 2".
- After picking, the zone-1 clock shows "TOKYO" and its time updated; the zone-2 clock shows "DENVER" and its time updated.
- No error toast, red banner, or red-screen RN error is visible.

## Verdict

Pass iff clicking the zone-1 (Berlin) clock opened the zone picker, searching "Tok" and clicking the Tokyo row changed the zone-1 clock to "TOKYO" with an updated time, AND clicking the zone-2 (Colombo) clock and picking "Denver" changed the zone-2 clock to "DENVER" with an updated time. FAIL if a picker did not open, if either zone did not change to its target city, if the wrong clock changed, or if any error toast / red-screen RN error is shown.
