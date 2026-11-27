import { expect, test } from "@playwright/test";

const spoken =
  "Growth a year: revenue's compound annual growth rate from the first to the newest of ten fiscal years";

test("the growth column says it is revenue's growth a year since a fiscal year", async ({
  page,
}) => {
  await page.goto("/companies", { waitUntil: "networkidle" });
  const table = page.getByRole("table", { name: "Ready companies, newest fiscal year of each" });
  const header = table.getByRole("columnheader", { name: spoken });
  const visible = await header.getByRole("button").evaluate((button) =>
    [...button.children]
      .filter((child) => child.getAttribute("aria-hidden") === "true")
      .filter((child) => !child.classList.contains("arrow"))
      .map((child) => child.textContent)
      .join(""),
  );
  expect(visible).toBe("Growth a year");

  const apple = table.getByRole("row").filter({ hasText: "AAPL" });
  await expect(apple.getByText("since fiscal 2017", { exact: true })).toBeVisible();
  await expect(page.getByText(/It is not the\s+year-over-year change\./)).toBeVisible();
});

test("the table shows from 1240 pixels wide without spilling, and cards below", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1240, height: 900 });
  await page.goto("/companies", { waitUntil: "networkidle" });
  const table = page.getByRole("table", { name: "Ready companies, newest fiscal year of each" });
  await expect(table.getByRole("columnheader", { name: spoken })).toBeVisible();
  const spill = await table.evaluate(
    (element) => element.scrollWidth - (element.parentElement?.clientWidth ?? 0),
  );
  expect(spill).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 1239, height: 900 });
  await expect(table.getByRole("columnheader", { name: spoken })).toBeHidden();
  const apple = table.getByRole("row").filter({ hasText: "AAPL" });
  await expect(apple.getByText("Growth a year", { exact: true })).toBeVisible();
  await expect(apple.getByText("since fiscal 2017", { exact: true })).toBeVisible();
});
