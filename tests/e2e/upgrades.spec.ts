import { test, expect } from "@playwright/test";
test("introduction ends and How It Works is accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".brand-introduction")).toHaveCount(0, {
    timeout: 3000,
  });
  await page.getByRole("button", { name: "How It Works", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Track spacecraft");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".brand-introduction")).toHaveCount(0);
});
test("real catalog selection exposes orbital metadata and follow controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Orbit explorer", exact: true })
    .click();
  await page.getByLabel("Search satellites", { exact: true }).fill("ISS");
  const satellite = page.locator(".satlist button").first();
  await expect(satellite).toBeVisible({ timeout: 45000 });
  await satellite.click();
  await expect(
    page.getByRole("region", { name: "Selected satellite" }),
  ).toContainText("Inclination");
  await page
    .getByRole("button", { name: "Follow satellite", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Exit follow", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Playback speed", { exact: true }).selectOption("30");
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Selected satellite" }),
  ).toHaveCount(0);
});
test("independent archive searches preserve 2014 baseline", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Independent historical periods").check();
  await page
    .getByText("Imagery source", { exact: true })
    .locator("select")
    .selectOption("landsat-c2-l2");
  await page
    .getByRole("button", { name: "Find baseline observations", exact: true })
    .click();
  await expect(page.locator(".scene").first()).toBeVisible({ timeout: 45000 });
  await page.locator(".scene").first().click();
  await page
    .getByRole("button", { name: "Find comparison observations", exact: true })
    .click();
  await expect(page.locator(".scene").first()).toBeVisible({ timeout: 45000 });
  await page.locator(".scene").first().click();
  await expect(
    page.getByRole("heading", { name: "Historical Landsat comparison" }),
  ).toBeVisible();
  await expect(page.locator(".historical-viewer .images img")).toHaveCount(2);
  await expect
    .poll(
      () =>
        page
          .locator(".historical-viewer .images img")
          .evaluateAll((images) =>
            images.every(
              (i) =>
                (i as HTMLImageElement).complete &&
                (i as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      { timeout: 60000 },
    )
    .toBe(true);
});
