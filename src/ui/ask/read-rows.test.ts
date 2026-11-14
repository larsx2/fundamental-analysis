import { describe, expect, it } from "vitest";
import type { LookupResult } from "../../shared/lookups";
import { filingRows, readRows, searchWords } from "./read-rows";
import type { LookupRead } from "./use-ask";

const report = "Annual report (10-K), filed on 3 November 2026";
const folder = "https://www.sec.gov/Archives/edgar/data/320193/000032019326000101/";

const result = (
  lookup: string,
  title: string,
  detail: string,
  lines: ReadonlyArray<number>,
  url: string,
): LookupResult => ({
  lookup,
  title,
  detail,
  figures: Object.fromEntries(lines.map((line) => [`line ${line}`, `Paragraph ${line}`])),
  notes: [],
  drawing: null,
  filings: [{ form: "Annual report (10-K)", filedOn: "2026-11-03", url }],
});

const search = (id: string, query: string, lines: ReadonlyArray<number>): LookupRead => ({
  id,
  lookup: "search_report",
  input: { ticker: "aapl", query },
  status: "read",
  result: result("search_report", report, `detail of ${query}`, lines, `${folder}aapl-10k.htm`),
  error: null,
});

const trend: LookupRead = {
  id: "trend",
  lookup: "trend",
  input: { ticker: "AAPL" },
  status: "read",
  result: result("trend", "Revenue, fiscal 2017 to 2026", "10 fiscal years", [], folder),
  error: null,
};

describe("the rows of what was read", () => {
  it("show an annual report once however often it was searched", () => {
    const rows = readRows([
      search("a", "section:overview revenue", []),
      search("b", '"net sales increased"', [10, 11, 12]),
      trend,
      search("c", '"net sales"', [11, 12, 40]),
    ]);
    expect(rows.map((row) => row.title)).toEqual([report, "Revenue, fiscal 2017 to 2026"]);
    expect(rows[0]?.ids).toEqual(["a", "b", "c"]);
    expect(rows[0]?.lines).toEqual(["4 paragraphs found in 3 searches"]);
    expect(rows[1]?.lines).toEqual(["10 fiscal years"]);
  });

  it("say so when the searches found nothing, without showing the search words", () => {
    expect(readRows([search("a", "section:highlights", [])])[0]?.lines).toEqual(["Nothing found"]);
  });

  it("keep each company's annual report apart", () => {
    const other: LookupRead = {
      ...search("z", "rivals", [5]),
      input: { ticker: "COST" },
    };
    expect(readRows([search("a", "rivals", [5]), other])).toHaveLength(2);
  });

  it("name a report search that is still running or that failed", () => {
    const running: LookupRead = {
      ...search("a", "rivals", []),
      status: "reading",
      result: null,
    };
    expect(readRows([running])[0]).toMatchObject({
      status: "reading",
      title: "The annual report",
      lines: ["Reading"],
    });
    const failed: LookupRead = {
      ...running,
      status: "failed",
      error: "No report.",
    };
    expect(readRows([failed])[0]).toMatchObject({
      status: "failed",
      lines: ["No report."],
    });
  });
});

describe("the filings the figures come from", () => {
  it("list a filing once, by its document rather than its folder", () => {
    expect(filingRows([trend, search("a", "rivals", [5])]).map((filing) => filing.url)).toEqual([
      `${folder}aapl-10k.htm`,
    ]);
  });
});

describe("search words as the reader would say them", () => {
  it("drop the search syntax", () => {
    expect(searchWords('section:"results of operations" revenue')).toBe(
      "results of operations revenue",
    );
    expect(searchWords("compet* OR rival*")).toBe("compet or rival");
    expect(searchWords("NEAR(buyback dividend, 10)")).toBe("buyback dividend");
  });
});
