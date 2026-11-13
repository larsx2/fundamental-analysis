import { expect, test } from "@playwright/test";
import { readNetworkLog } from "./network-log";

const harmless = [
  /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1\//,
  /^https:\/\/www\.wikidata\.org\//,
  /^https:\/\/commons\.wikimedia\.org\//,
];

test("collecting a company asks for the SEC contact once and opens it when ready", async ({
  page,
}) => {
  expect(readNetworkLog()).toContain("listening on port 4120 with the fake");

  await page.goto("/companies", { waitUntil: "networkidle" });
  const find = page.getByRole("combobox", {
    name: "Find a company by name or ticker",
  });
  await find.fill("EXMP");
  await expect(page.getByRole("option", { name: /Example/ })).toBeVisible();
  await find.press("Enter");

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Collect Example Corp?" })).toBeVisible();
  await sheet.getByLabel("Name").fill("Test Reader");
  await sheet.getByLabel("Email").fill("not an email");
  await sheet.getByRole("button", { name: "Save and collect" }).click();
  await expect(sheet.getByText("Enter an email address, such as name@example.com.")).toBeVisible();
  expect(readNetworkLog()).not.toMatch(/^(answered|refused) /m);

  await sheet.getByLabel("Email").fill("reader@example.com");
  await sheet.getByRole("button", { name: "Save and collect" }).click();
  await expect(page).toHaveURL(/\/EXMP\//, { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("fiscal");

  const log = readNetworkLog();
  expect(log).toContain("answered https://data.sec.gov/submissions/CIK0000000001.json");
  expect(log).toContain("answered https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json");
  const turnedAway = log
    .split("\n")
    .filter((line) => line.startsWith("refused "))
    .map((line) => line.slice("refused ".length));
  expect(turnedAway.filter((url) => !harmless.some((each) => each.test(url)))).toEqual([]);
});
