import { expect, test } from "@playwright/test";
import { addNamedCue, firstRun, shot } from "./helpers";

// The web version of tests/maestro/flows/delete-cue.yaml.
test("delete a cue", async ({ page }) => {
  await firstRun(page, "delete-cue-01-first-run");
  await addNamedCue(page, "Cue To Delete");

  await page.getByTestId("cue-delete").click();
  // The app asks before deleting.
  await expect(page.getByText("Delete cue?", { exact: true })).toBeVisible();
  await shot(page, "delete-cue-02-confirm");

  await page.getByTestId("confirm-ok").click();
  await expect(page.getByText("Cue To Delete", { exact: true })).toHaveCount(0);
  // Wait for the dialog to finish closing, so the screenshot shows the home screen.
  await expect(page.getByText("Delete cue?", { exact: true })).toBeHidden();
  await shot(page, "delete-cue-03-done");
});
