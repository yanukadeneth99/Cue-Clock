import { expect, test } from "@playwright/test";
import { firstRun, shot } from "./helpers";

// The web version of tests/maestro/flows/cue-passes.yaml. No alert is set, so the browser never asks for notification permission.
test("a cue passes", async ({ page }) => {
  // The cue needs up to 2 minutes to pass, so this test gets more time than the others.
  test.setTimeout(240_000);
  await firstRun(page, "cue-passes-01-first-run");

  await page.getByTestId("add-cue-button").click();

  // Set the cue about 2 minutes from now with the arrows, the same way as plan-near-cue.js in the Maestro flow.
  // A new cue starts at the next full hour. Zone 1 is Berlin, whose minutes match UTC minutes.
  const target = new Date().getUTCMinutes() + 2;
  const delta = target - 60;
  if (delta < -30) {
    await page.getByTestId("target-time-hour-down").click();
    for (let i = 0; i < target; i++) await page.getByTestId("target-time-minute-up").click();
  } else if (delta <= 0) {
    for (let i = 0; i < -delta; i++) await page.getByTestId("target-time-minute-down").click();
  } else {
    for (let i = 0; i < delta; i++) await page.getByTestId("target-time-minute-up").click();
  }
  await shot(page, "cue-passes-02-modal-open");

  await page.getByTestId("cue-name-input").fill("Passing Cue");
  await page.getByTestId("cue-save").click();
  await expect(page.getByText("Passing Cue", { exact: true })).toBeVisible();
  await shot(page, "cue-passes-03-counting");

  // Once the time is reached, the cue moves into a small "PASSED" strip above the cards.
  await expect(page.getByText("PASSED", { exact: true })).toBeVisible({ timeout: 180_000 });
  await expect(page.getByText("Passing Cue", { exact: true })).toBeVisible();
  await shot(page, "cue-passes-04-passed");
});
