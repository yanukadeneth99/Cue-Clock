import { expect, test } from "@playwright/test";
import { firstRun, shot } from "./helpers";

// The web version of tests/maestro/flows/add-cue.yaml.
test("add a cue", async ({ page }) => {
  await firstRun(page, "add-cue-01-first-run");

  await page.getByTestId("add-cue-button").click();

  // The web has no pop-up time picker. Move the target hour up by one, so the cue is not at the default time.
  await page.getByTestId("target-time-hour-up").click();
  await shot(page, "add-cue-02-modal-open");

  await page.getByTestId("cue-name-input").fill("Playwright Test Cue");
  await page.getByTestId("cue-save").click();

  await expect(page.getByText("Playwright Test Cue").first()).toBeVisible();
  await shot(page, "add-cue-03-done");
});
