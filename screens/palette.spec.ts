import { expect, test } from "@playwright/test";

test("switching company from the search panel leaves the screen clickable", async ({ page }) => {
  await page.goto("/AAPL/where-the-money-goes?year=2023", { waitUntil: "networkidle" });
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("COST");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/COST\//);
  await expect(page.locator(".palette-backdrop")).toHaveCount(0);
  await page.getByRole("button", { name: "Table" }).click({ timeout: 3000 });
  await expect(page).toHaveURL(/drawing=table/);
});

test("the search panel works while the flow is full screen", async ({ page }) => {
  await page.goto("/AAPL/where-the-money-goes?year=2023", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Full screen" }).click();
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("COST");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/COST\//);
});
