import { describe, expect, it } from "@effect/vitest";
import { coverageOf } from "./coverage";

const today = new Date("2026-11-11");

const company = (name: string, sic: string, forms: ReadonlyArray<string>, date = "2026-02-20") => ({
  name,
  sic,
  filings: ["8-K", "4", ...forms].map((form) => ({ form, date })),
  today,
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

  // The SEC.s industry codes: 6000 to 6199 are banks and lenders, and 6300 to
  // 6411 are insurers, their agents and brokers. The codes between and after
  // them, such as stockbrokers (6211) and property agents (6531), are covered.
  it("declines the whole range of lenders and insurers, and nothing just outside them", () => {
    const covered = (sic: string) => coverageOf(company("Made Up", sic, ["10-K"])).covered;
    expect(["6000", "6199", "6300", "6411"].map(covered)).toEqual([false, false, false, false]);
    expect(["5999", "6200", "6211", "6299", "6412", "6531"].map(covered)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it("declines a company that files another form instead of an annual report (10-K), naming it", () => {
    expect(coverageOf(company("Toyota", "3711", ["6-K", "20-F"]))).toMatchObject({
      covered: false,
      reason: expect.stringContaining("files a 20-F each year"),
    });
  });

  it("declines a company whose newest annual report (10-K) is more than eighteen months old", () => {
    expect(coverageOf(company("Gone Dark", "3571", ["10-K"], "2024-03-01"))).toMatchObject({
      covered: false,
      reason: expect.stringContaining("filed its last annual report (10-K) on 2024-03-01"),
    });
  });
});
