import { expect, test } from "@playwright/test";

test("an unknown path shows a plain page with a way back", async ({ page }) => {
  const response = await page.goto("/a/b/c");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Companies" })).toHaveAttribute(
    "href",
    "/companies",
  );
});

test("a screen that breaks shows a plain page with a way back", async ({ page }) => {
  await page.goto("/companies", { waitUntil: "networkidle" });
  await page.route("**/_serverFn/**", (route) => route.fulfill({ status: 500, body: "x" }));
  await page.locator('a[href^="/AAPL/overview"]').first().click();

  await expect(page.getByRole("heading", { name: "This screen could not open" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Companies" })).toBeVisible();
  await expect(page.getByText("Something went wrong!")).toHaveCount(0);
});
