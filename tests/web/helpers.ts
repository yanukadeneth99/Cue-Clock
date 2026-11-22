import { expect, test, type Page } from "@playwright/test";

// Saves a screenshot into this test's output folder, so CI keeps it with the results.
export async function shot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`) });
}

// The web version of tests/maestro/flows/common/first-run.yaml: open the app fresh and close the first-run dialogs.
// Each test gets a fresh browser profile, so the app always opens as a first visit.
export async function firstRun(page: Page, shotName: string) {
  await page.goto("/");
  // The web build skips the Android setup sheet and asks the analytics question first.
  await page.getByTestId("consent-decline").click({ timeout: 30_000 });
  // Declining asks once more, so confirm.
  await page.getByTestId("optout-confirm").click();
  await expect(page.getByTestId("add-cue-button")).toBeVisible({ timeout: 30_000 });
  await shot(page, shotName);
}

// The web version of tests/maestro/flows/common/add-named-cue.yaml: add a cue one hour after the default time.
export async function addNamedCue(page: Page, name: string) {
  await page.getByTestId("add-cue-button").click();
  await page.getByTestId("target-time-hour-up").click();
  await page.getByTestId("cue-name-input").fill(name);
  await page.getByTestId("cue-save").click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}
