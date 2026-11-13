import { expect, test } from "@playwright/test";

test("server actions answer the tool's own pages and no other site", async ({ page, request }) => {
  const actions: Array<string> = [];
  page.on("request", (sent) => {
    if (sent.url().includes("/_serverFn/")) actions.push(sent.url());
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('a[href="/companies"]').first().click();
  await page.waitForLoadState("networkidle");
  const action = actions[0];
  expect(action).toBeDefined();

  const own = await request.get(action!, {
    headers: { "x-tsr-serverFn": "true", "sec-fetch-site": "same-origin" },
  });
  expect(own.status()).toBe(200);

  const otherSite = await request.get(action!, {
    headers: {
      "x-tsr-serverFn": "true",
      origin: "https://example.com",
      "sec-fetch-site": "cross-site",
    },
  });
  expect(otherSite.status()).toBe(403);
});
