# Web tests

Playwright is a small tool that opens the Cue Clock web app in a real Chrome browser and clicks and types for you. Each test is a short script ending in `.spec.ts`. These tests check the web build of the app, the same one that goes live at a release.

## Run the tests

1. Build the web app: run `npm run build:web` in `app/`. The result goes to `app/dist/`.
2. Serve that folder, for example `npx serve app/dist -l 8081` from the repo root.
3. In `tests/web/`, run `npm ci` and then `npx playwright install chromium` once.
4. Run `npx playwright test`. To use another address, set `CUE_WEB_URL`, for example `CUE_WEB_URL=http://localhost:3000 npx playwright test`.

The report is written to `tests/web/playwright-report/`. Open it with `npx playwright show-report`.

## Tests

Each one is the web version of the Maestro flow with the same name in `tests/maestro/flows/`, and uses the same `testID` names. The shared first-run steps live in `helpers.ts`, so they are written once.

- `add-cue.spec.ts`: add a cue with a name and check it shows.
- `edit-cue.spec.ts`: add a cue, open it again, rename it, and check the new name shows and the old one is gone.
- `delete-cue.spec.ts`: add a cue, delete it, confirm, and check it is gone.
- `cue-buffer.spec.ts`: add a cue with a 1 minute buffer and check the card shows "Buffer −01:00".
- `settings.spec.ts`: switch off 24-hour time and seconds, and check the clocks now show AM or PM and no seconds.
- `second-zone.spec.ts`: change the second clock to Tokyo and check it shows.
- `cue-passes.spec.ts`: add a cue about 2 minutes ahead with the arrows, wait for it to pass, and check it moves to the "PASSED" strip. It takes up to 3 minutes.

Screenshots are saved in `tests/web/test-results/`, with names like `edit-cue-02-modal-open.png`.

## What the tests expect

- Each test starts with an empty browser, so the app opens as a first visit and shows the analytics question. The test says "No thanks" and confirms.
- The window is desktop-sized. A phone-sized window shows the "Get Cue Clock on Android" cover instead of the app.
- Buttons and fields are found by their `testID` in the app code, which the web build turns into `data-testid`. They are the same names the Maestro flows use.

## In CI

`web-app-verify.yml` builds the web app, serves it and runs these tests on every pull request that changes `app/` or `tests/web/`. Gemini then reviews the screenshots, see [tests/ai-review](../ai-review/README.md). The report, screenshots and `review.json` are kept for 7 days.
