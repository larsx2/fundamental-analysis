import { expect, type Page, test } from "@playwright/test";

// Opens the search panel and picks Costco, waiting at each step for the panel
// to be ready, so a slow frame cannot swallow the keys.
const pickCostco = async (page: Page) => {
  await page.keyboard.press("ControlOrMeta+k");
  const search = page.getByRole("combobox", { name: "Find a ready company" });
  await expect(search).toBeFocused();
  await search.fill("COST");
  await expect(page.getByRole("option", { selected: true })).toContainText("COST");
  await search.press("Enter");
};

test("switching company from the search panel leaves the screen clickable", async ({ page }) => {
  await page.goto("/AAPL/where-the-money-goes?year=2023", { waitUntil: "networkidle" });
  await pickCostco(page);
  await expect(page).toHaveURL(/\/COST\//);
  await expect(page.locator(".palette-backdrop")).toHaveCount(0);
  await page.getByRole("button", { name: "Table" }).click({ timeout: 3000 });
  await expect(page).toHaveURL(/drawing=table/);
});

test("the search panel works while the flow is full screen", async ({ page }) => {
  await page.goto("/AAPL/where-the-money-goes?year=2023", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Full screen" }).click();
  await pickCostco(page);
  await expect(page).toHaveURL(/\/COST\//);
});
