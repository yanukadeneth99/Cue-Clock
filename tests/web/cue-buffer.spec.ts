import { expect, test } from "@playwright/test";
import { firstRun, shot } from "./helpers";

// The web version of tests/maestro/flows/cue-buffer.yaml.
test("add a cue with a buffer", async ({ page }) => {
  await firstRun(page, "cue-buffer-01-first-run");

  await page.getByTestId("add-cue-button").click();
  await page.getByTestId("target-time-hour-up").click();
  // Buffer is how much earlier to be ready. One click on its first arrow adds one minute.
  await page.getByTestId("buffer-time-hour-up").click();
  await shot(page, "cue-buffer-02-modal-open");

  await page.getByTestId("cue-name-input").fill("Buffer Cue");
  await page.getByTestId("cue-save").click();

  await expect(page.getByText("Buffer Cue", { exact: true })).toBeVisible();
  // The card shows the buffer as minus minutes and seconds.
  await expect(page.getByText("−01:00", { exact: true })).toBeVisible();
  await shot(page, "cue-buffer-03-done");
});
