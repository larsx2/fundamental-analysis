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

test("a passage of the annual report shows under the answer, with a link to the filing", async ({
  page,
}) => {
  await askWithReply(page, [
    {
      type: "answer",
      answer: {
        lead: "Apple says its markets are highly competitive.",
        sentences: [],
        quotes: [
          {
            text: "The markets for the Company's products and services are highly competitive.",
            source: "Annual report (10-K), filed on 3 November 2026",
            url: "https://www.sec.gov/Archives/edgar/data/320193/aapl.htm",
          },
        ],
        drawing: null,
        next: [],
      },
    },
  ]);

  const quote = page.locator(".ask-quote");
  await expect(quote.locator("blockquote")).toHaveText(
    "The markets for the Company's products and services are highly competitive.",
  );
  await expect(quote.getByRole("link", { name: "Read it in the filing ↗" })).toHaveAttribute(
    "href",
    "https://www.sec.gov/Archives/edgar/data/320193/aapl.htm",
  );
});

test("an answer's headline underlines no word, and its chart lists every part of the dollar once", async ({
  page,
  request,
}) => {
  const reply = await request.post("/api/lookup", {
    headers: sameComputer,
    data: { name: "dollar", input: { ticker: "AAPL", fiscalYear: 2023 } },
  });
  const { result } = (await reply.json()) as { result: unknown };

  await askWithReply(page, [
    { type: "reading", id: "1", lookup: "dollar", input: { ticker: "AAPL" } },
    { type: "read", id: "1", lookup: "dollar", result, error: null },
    {
      type: "answer",
      answer: {
        lead: "Apple kept a quarter of its revenue as net income.",
        sentences: ["Cost of revenue took the most."],
        drawing: "dollar",
        next: ["Is Apple growing?"],
      },
    },
  ]);

  await expect(page.locator(".ask-lead")).toBeVisible();
  await expect(page.locator(".ask-lead .term")).toHaveCount(0);
  await expect(page.locator(".ask-sentence .term")).toHaveText(["Cost of revenue"]);
  const receipt = page.locator(".ask-receipt li");
  await expect(receipt.first()).toContainText(/Cost of revenue\s*\d+¢/);
  await expect(receipt.last()).toContainText(/Net income\s*\d+¢/);
  await expect(page.locator(".ask-receipt .term")).not.toContainText(["Cost of revenue"]);
  await expect(receipt.last().locator(".term")).toHaveText("Net income");
  await expect(page.getByRole("group", { name: "Topics" })).toHaveCount(0);
});

test("the topics stay in the question box when an answer offers nothing to ask next", async ({
  page,
}) => {
  await askWithReply(page, [
    {
      type: "answer",
      answer: { lead: "Apple brought in a lot.", sentences: [], drawing: null, next: [] },
    },
  ]);

  await expect(page.locator(".ask-lead")).toBeVisible();
  await expect(page.getByRole("group", { name: "Topics" })).toBeVisible();
});
