import { expect, test } from "@playwright/test";

const pages = [
  { name: "apple-flow", path: "/AAPL/where-the-money-goes?year=2023" },
  { name: "costco-flow", path: "/COST/where-the-money-goes?year=2023" },
  { name: "microsoft-table", path: "/MSFT/where-the-money-goes?year=2015&drawing=table" },
];

for (const { name, path } of pages) {
  test(`where the money goes: ${name}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("main")).toHaveScreenshot(`${name}.png`);
  });
}

test("the flow opens full screen and Escape steps back one layer at a time", async ({ page }) => {
  await page.goto("/AAPL/where-the-money-goes?year=2023", { waitUntil: "networkidle" });
  const panel = page.locator("section.panel").filter({ has: page.locator("#chart-title") });

  await page.getByRole("button", { name: "Full screen" }).click();
  await expect(panel).toHaveClass(/is-full/);

  await page
    .locator("#flow-profit")
    .getByRole("button", { name: /^Net income/ })
    .click();
  await expect(page.locator(".flow-explorer")).toHaveClass(/is-open/);

  await page.keyboard.press("Escape");
  await expect(page.locator(".flow-explorer")).not.toHaveClass(/is-open/);
  await expect(panel).toHaveClass(/is-full/);

  await page.keyboard.press("Escape");
  await expect(panel).not.toHaveClass(/is-full/);
  await expect(
    page.locator("#flow-profit").getByRole("button", { name: /^Net income/ }),
  ).toBeFocused();
});

test("pinching or Ctrl and scroll over the flow zooms it", async ({ page }) => {
  await page.goto("/AAPL/where-the-money-goes?year=2023", { waitUntil: "networkidle" });
  const zoomIn = page.getByRole("button", { name: "Zoom in to gross profit" });
  const views = page.locator(".flow-views").boundingBox();
  const box = (await views)!;
  await page.mouse.move(box.x + 200, box.y + 200);

  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -60);
  await page.keyboard.up("Control");
  await expect(zoomIn).toBeDisabled();

  await page.waitForTimeout(500);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 60);
  await page.keyboard.up("Control");
  await expect(zoomIn).toBeEnabled();
});
