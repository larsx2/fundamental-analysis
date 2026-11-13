import { expect, test } from "@playwright/test";

test("the Page Down key moves the timeline into the year before", async ({ page }) => {
  await page.goto("/AAPL/timeline?year=2023", { waitUntil: "networkidle" });
  await expect(page.getByText("Timeline, fiscal 2023")).toBeVisible();

  const months = page.getByRole("slider", { name: "Month on the timeline" });
  await months.focus();
  await months.press("PageDown");

  await expect(page).toHaveURL(/year=2022/);
  await expect(page.getByText("Timeline, fiscal 2022")).toBeVisible();
  await expect(months).toHaveAttribute("aria-valuetext", /fiscal 2022/);
});
