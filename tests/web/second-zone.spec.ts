import { expect, test } from "@playwright/test";
import { firstRun, shot } from "./helpers";

// The web version of tests/maestro/flows/second-zone.yaml.
test("change the second zone", async ({ page }) => {
  await firstRun(page, "second-zone-01-first-run");

  await page.getByTestId("zone2-card").click();
  // Search by the full zone name, so the typed text cannot be mistaken for the "Tokyo" row.
  await page.getByTestId("zone-search").fill("Asia/Tok");
  await shot(page, "second-zone-02-modal-open");
  await page.getByText("Tokyo", { exact: true }).click();

  // The clock card shows the city followed by its zone, for example "TOKYO (GMT+9)".
  await expect(page.getByText(/^tokyo \(/i)).toBeVisible();
  await expect(page.getByText(/^colombo \(/i)).toHaveCount(0);
  await shot(page, "second-zone-03-done");
});
