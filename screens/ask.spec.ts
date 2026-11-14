import { expect, test, type Page } from "@playwright/test";

const sameComputer = { "sec-fetch-site": "same-origin" };

const askWithReply = async (page: Page, events: ReadonlyArray<unknown>) => {
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body: events.map((each) => JSON.stringify(each)).join("\n") + "\n",
    }),
  );
  await page.goto("/AAPL/ask", { waitUntil: "networkidle" });
  await page.getByRole("textbox").first().fill("How much did Apple bring in?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
};

test("an answer marks the number that did not come from a lookup", async ({ page, request }) => {
  const reply = await request.post("/api/lookup", {
    headers: sameComputer,
    data: { name: "dollar", input: { ticker: "AAPL", fiscalYear: 2023 } },
  });
  const { result } = (await reply.json()) as {
    result: { figures: Record<string, string> };
  };
  const figure = Object.values(result.figures).find((each) => each.startsWith("$"))!;

  await askWithReply(page, [
    { type: "reading", id: "1", lookup: "dollar", input: { ticker: "AAPL" } },
    { type: "read", id: "1", lookup: "dollar", result, error: null },
    {
      type: "answer",
      answer: {
        lead: `Apple brought in ${figure}.`,
        sentences: ["Its net income was $1.23 billion."],
        drawing: "dollar",
        next: ["Is Apple growing?"],
      },
    },
  ]);

  await expect(page.getByText(`Apple brought in ${figure}.`)).toBeVisible();
  await expect(page.locator(".ask-unchecked")).toHaveCount(1);
  await expect(page.locator(".ask-unchecked")).toContainText("$1.23 billion");
  await expect(
    page.getByText("One number in this answer did not come from a lookup"),
  ).toBeVisible();
});

test("a signed-out assistant says how to sign in", async ({ page }) => {
  await askWithReply(page, [{ type: "failed", signedOut: true, message: "401 Unauthorized" }]);

  await expect(page.getByText("The assistant is not signed in on this computer")).toBeVisible();
});

test("a long answer opens at its first line, not at its end", async ({ page }) => {
  const sentences = Array.from(
    { length: 40 },
    (_, index) => `Point ${index + 1} explains one more part of where the money went this year.`,
  );
  await askWithReply(page, [
    { type: "thinking", id: "1", text: "Reading what Apple reported." },
    {
      type: "answer",
      answer: { lead: "Apple brought in a lot.", sentences, drawing: null, next: [] },
    },
  ]);

  await expect(page.getByText("Point 40 explains")).toBeAttached();
  await expect(page.locator(".ask-lead")).toBeInViewport();
});
