import { expect, test } from "@playwright/test";

const pages = [
  { name: "apple-overview", path: "/AAPL/overview?year=2023" },
  { name: "costco-overview", path: "/COST/overview?year=2023" },
  { name: "apple-statements", path: "/AAPL/statements?year=2023" },
  { name: "microsoft-statements", path: "/MSFT/statements?year=2015" },
  { name: "apple-timeline", path: "/AAPL/timeline?year=2023" },
  { name: "costco-timeline", path: "/COST/timeline?year=2023" },
  { name: "microsoft-timeline", path: "/MSFT/timeline?year=2015" },
];

// Tall enough that the menu bar, fixed to the bottom of the window, sits below
// every screen instead of across it.
test.use({ viewport: { width: 1440, height: 2600 } });

for (const { name, path } of pages) {
  test(`company screen: ${name}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("main")).toHaveScreenshot(`${name}.png`);
  });
}
