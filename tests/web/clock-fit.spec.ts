import { expect, test, type Locator } from "@playwright/test";
import { firstRun } from "./helpers";

// Fails if `inner` sticks out past any edge of `outer`. Half a pixel of give for rounding.
async function expectInside(inner: Locator, outer: Locator, label: string) {
  const a = await inner.boundingBox();
  const b = await outer.boundingBox();
  expect(a, `${label} has no box`).not.toBeNull();
  expect(b, `card for ${label} has no box`).not.toBeNull();
  if (!a || !b) return;
  expect(a.x, `${label} left edge`).toBeGreaterThanOrEqual(b.x - 0.5);
  expect(a.y, `${label} top edge`).toBeGreaterThanOrEqual(b.y - 0.5);
  expect(a.x + a.width, `${label} right edge`).toBeLessThanOrEqual(b.x + b.width + 0.5);
  expect(a.y + a.height, `${label} bottom edge`).toBeLessThanOrEqual(b.y + b.height + 0.5);
}

// Each clock card's time (HH:MM and the seconds) must fit inside the card at the default 1280x800 window.
test("clock times fit inside their cards", async ({ page }) => {
  await firstRun(page, "clock-fit-01-first-run");

  for (const zone of ["zone1", "zone2"]) {
    const card = page.getByTestId(`${zone}-card`);
    const time = page.getByTestId(`${zone}-time`);
    const seconds = page.getByTestId(`${zone}-seconds`);
    await expect(time).toBeVisible();
    await expect(seconds).toBeVisible();
    await expectInside(time, card, `${zone}-time`);
    await expectInside(seconds, card, `${zone}-seconds`);
    // HH:MM must not be cut short with "…".
    const cut = await time.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(cut, `${zone}-time is cut short`).toBe(false);
  }
});
