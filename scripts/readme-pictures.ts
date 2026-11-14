import { spawn } from "node:child_process";
import { chromium, type Page } from "@playwright/test";

const port = 4121;
const base = `http://127.0.0.1:${port}`;
const folder = "docs/pictures";

const pictures = [
  { name: "home", path: "/", height: 1000 },
  { name: "where-the-money-goes", path: "/AAPL/where-the-money-goes?year=2023", height: 1320 },
  { name: "statements", path: "/AAPL/statements", height: 1000 },
  { name: "timeline", path: "/AAPL/timeline", height: 1150 },
  { name: "companies", path: "/companies", height: 760 },
];

const lookUp = async (name: string, input: Record<string, unknown>) => {
  const reply = await fetch(`${base}/api/lookup`, {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
    body: JSON.stringify({ name, input }),
  });
  const { result } = (await reply.json()) as { result: { figures: Record<string, string> } };
  return result;
};

const askPicture = async (page: Page) => {
  const company = await lookUp("company", { ticker: "AAPL" });
  const dollar = await lookUp("dollar", { ticker: "AAPL", fiscalYear: 2023 });
  const cents = (part: string) => dollar.figures[`${part}, cents of each dollar of revenue`] ?? "";
  const events = [
    { type: "reading", id: "1", lookup: "company", input: { ticker: "AAPL" } },
    { type: "read", id: "1", lookup: "company", result: company, error: null },
    { type: "reading", id: "2", lookup: "dollar", input: { ticker: "AAPL", fiscalYear: 2023 } },
    { type: "read", id: "2", lookup: "dollar", result: dollar, error: null },
    {
      type: "answer",
      answer: {
        lead: `Apple kept ${cents("Net income")} of each dollar of revenue as net income in fiscal 2023.`,
        sentences: [
          `Cost of revenue took ${cents("Cost of revenue")}, research and development ${cents("Research and development")}, and selling, general and administrative ${cents("Selling, general and administrative")}.`,
          `Interest, other income and tax took ${cents("Interest, other income and tax")}.`,
        ],
        drawing: "dollar",
        next: ["Is Apple growing?", "What does Apple do with its cash?"],
      },
    },
  ];
  await page.route("**/api/ask", async (route) => {
    await Bun.sleep(6_000);
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: events.map((each) => JSON.stringify(each)).join("\n") + "\n",
    });
  });
  await page.goto(`${base}/AAPL/ask`, { waitUntil: "networkidle" });
  await page.getByRole("textbox").first().fill("Where does Apple's money go?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await page.locator(".ask-drawing").waitFor();
  await page.waitForURL(/[?&]t=/);
  await page.waitForLoadState("networkidle");
};

await Bun.$`bun scripts/screens-database.ts`;

const server = spawn("bun", ["--bun", "vp", "dev", "--port", String(port), "--strictPort"], {
  env: { ...process.env, DATABASE_FILE: "data/screens.db" },
  stdio: "ignore",
  detached: true,
});

try {
  const deadline = Date.now() + 120_000;
  while (
    !(await fetch(`${base}/companies`).then(
      (response) => response.ok,
      () => false,
    ))
  ) {
    if (Date.now() > deadline) throw new Error(`The tool did not start on ${base}.`);
    await Bun.sleep(500);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  for (const { name, path, height } of pictures) {
    await page.setViewportSize({ width: 1440, height });
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${folder}/${name}.png` });
    console.log(`${folder}/${name}.png`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await askPicture(page);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${folder}/ask.png` });
  console.log(`${folder}/ask.png`);
  await browser.close();
} finally {
  if (server.pid !== undefined) process.kill(-server.pid);
}
