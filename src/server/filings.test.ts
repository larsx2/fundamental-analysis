import { describe, expect, it } from "vitest";
import { type CompanyFiling, corporateEvents } from "./filings";

const filing = (overrides: Partial<CompanyFiling>): CompanyFiling => ({
  accession: "0000000000-00-000000",
  form: "8-K",
  filedOn: "2024-01-01",
  reportDate: "2023-12-29",
  items: "",
  primaryDocument: "report.htm",
  ...overrides,
});

describe("corporate events from current reports", () => {
  it("keeps only items 5.02 and 2.01, and folds an amendment into its report", () => {
    const events = corporateEvents([
      filing({ accession: "a", items: "2.02,9.01", filedOn: "2024-02-01" }),
      filing({
        accession: "b",
        items: "5.02,9.01",
        filedOn: "2024-03-01",
        reportDate: "2024-02-28",
      }),
      filing({
        accession: "c",
        items: "2.01",
        filedOn: "2024-05-01",
        reportDate: "2024-04-30",
      }),
      filing({
        accession: "d",
        form: "8-K/A",
        items: "5.02",
        filedOn: "2024-03-20",
        reportDate: "2024-02-28",
      }),
    ]);
    expect(events.map((event) => [event.accession, event.kind, event.amendedOn])).toEqual([
      ["b", "officers", "2024-03-20"],
      ["c", "business", null],
    ]);
  });
});
