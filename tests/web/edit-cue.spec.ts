import { expect, test } from "@playwright/test";
import { addNamedCue, firstRun, shot } from "./helpers";

// The web version of tests/maestro/flows/edit-cue.yaml.
test("edit a cue", async ({ page }) => {
  await firstRun(page, "edit-cue-01-first-run");
  await addNamedCue(page, "First Name Cue");

  // Clicking the name on the card opens the cue with the name field ready.
  await page.getByText("First Name Cue", { exact: true }).click();
  await expect(page.getByText("Edit cue", { exact: true })).toBeVisible();
  await shot(page, "edit-cue-02-modal-open");

  await page.getByTestId("cue-name-input").fill("Renamed Cue");
  await page.getByTestId("cue-save").click();

  await expect(page.getByText("Renamed Cue", { exact: true })).toBeVisible();
  await expect(page.getByText("First Name Cue", { exact: true })).toHaveCount(0);
  await shot(page, "edit-cue-03-done");
});
