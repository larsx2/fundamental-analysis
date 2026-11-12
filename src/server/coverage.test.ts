import { describe, expect, it } from "@effect/vitest";
import { coverageOf } from "./coverage";

const company = (name: string, sic: string, forms: ReadonlyArray<string>) => ({
  name,
  sic,
  forms: ["8-K", "4", ...forms],
});

describe("coverageOf", () => {
  it("accepts a company outside finance and property that files an annual report (10-K)", () => {
    expect(coverageOf(company("Costco", "5331", ["10-Q", "10-K"]))).toEqual({
      covered: true,
    });
  });

  it("declines banks, insurers and property trusts, each with its own reason", () => {
    const reasons = [
      company("JPMorgan", "6021", ["10-K"]),
      company("Berkshire", "6331", ["10-K"]),
      company("Prologis", "6798", ["10-K"]),
    ].map((each) => coverageOf(each));
    expect(reasons.map((each) => each.covered)).toEqual([false, false, false]);
    expect(reasons.map((each) => ("reason" in each ? each.reason.split(".")[0] : ""))).toEqual([
      "JPMorgan is a bank or lender",
      "Berkshire is an insurer",
      "Prologis is a property trust",
    ]);
  });

  it("declines a company whose yearly report is not an annual report (10-K), naming its form", () => {
    expect(coverageOf(company("Toyota", "3711", ["6-K", "20-F"]))).toMatchObject({
      covered: false,
      reason: expect.stringContaining("as a 20-F"),
    });
  });
});
