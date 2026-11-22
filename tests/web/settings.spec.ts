import { expect, test } from "@playwright/test";
import { firstRun, shot } from "./helpers";

// The web version of tests/maestro/flows/settings.yaml.
test("change clock settings", async ({ page }) => {
  await firstRun(page, "settings-01-first-run");

  // A fresh app shows 24-hour time with seconds, so a ":ss" part is on screen and no AM or PM.
  const seconds = page.getByText(/^:\d{2}$/);
  const amPm = page.getByText(/^(AM|PM)$/);
  await expect(seconds.first()).toBeVisible();
  await expect(amPm).toHaveCount(0);

  await page.getByTestId("settings-button").click();
  await page.getByTestId("setting-24-hour").click();
  await page.getByTestId("setting-show-seconds").click();
  await shot(page, "settings-02-modal-open");
  await page.getByTestId("modal-close").click();

  // Now the clocks show AM or PM, and the seconds are gone.
  await expect(amPm.first()).toBeVisible();
  await expect(seconds).toHaveCount(0);
  await shot(page, "settings-03-done");
});
