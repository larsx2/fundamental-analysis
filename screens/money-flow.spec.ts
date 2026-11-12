import { expect, test } from "@playwright/test";

const pages = [
  { name: "apple-bars", path: "/AAPL/where-the-money-goes?year=2023" },
  { name: "costco-bars", path: "/COST/where-the-money-goes?year=2023" },
  { name: "costco-bands", path: "/COST/where-the-money-goes?year=2023&drawing=bands" },
  { name: "microsoft-table", path: "/MSFT/where-the-money-goes?year=2015&drawing=table" },
];

for (const { name, path } of pages) {
  test(`where the money goes: ${name}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("main")).toHaveScreenshot(`${name}.png`);
  });
}
