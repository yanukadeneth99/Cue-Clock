# AI screenshot review

After the Maestro flows (Android emulator) and the Playwright tests (web) run in CI, a small script sends each screenshot to Google's Gemini and asks whether it looks right. Gemini compares it with [expectations.md](./expectations.md), which says what each screen should show and lists the design rules (colours, fonts, nothing cut off or hidden).

## What you see

- A table on the run's summary page: one row per screenshot, with "ok", "issue" or "error" (could not be checked) and the issues found.
- A yellow warning on the pull request for each issue.
- A `review.json` file with the same results. On Android it is the `maestro-ai-review` artifact. On web it is inside the `playwright-report` artifact. Both are kept for 7 days.

## Advisory only

The review never fails a check, even when it finds issues or Gemini cannot be reached. It can be wrong, so treat each warning as a hint to look at the screenshot yourself. The real pass or fail comes from the test steps.

## Privacy

On the free Gemini plan, Google may use what is sent to improve its products. The script only sends the screenshots, their file names and `expectations.md`. The screenshots only show test data, such as "Renamed Cue", and the public app. Nothing else from the runner is sent, and the API key is never logged.

## Turn it on

1. Create a key in Google AI Studio.
2. In the GitHub repo, open Settings > Secrets and variables > Actions, and add a repository secret named `GEMINI_API_KEY` with the key.
3. Optional: on the Variables tab, add `GEMINI_MODEL` to use a different model. The default is `gemini-3.8-flash`.

Without the secret the review prints one notice and is skipped. Pull requests from forks and from Dependabot never get secrets, so the review is always skipped there.

## Change what is checked

Edit `expectations.md` in plain words. When you add a flow or a screenshot, add a line for its screen. The code is in `.github/scripts/review-screenshots.js` and `.github/scripts/lib/screenshot-review.js`, with tests run by `node --test .github/scripts/lib/*.test.js`.
