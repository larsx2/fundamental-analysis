import { describe, expect, it } from "vitest";
import type { StatementYear } from "../../functions/company";
import { type CheckedFigure, gapFigure } from "../../shared/figures";
import { cashValues, profitValues } from "./flows";
import { readPart } from "./read-part";

const filed = (value: number): CheckedFigure => ({
  kind: "reported",
  value,
  latest: { tag: "", value, accession: "", filedOn: "" },
  original: { tag: "", value, accession: "", filedOn: "" },
  doubtful: null,
});

const yearOf = (fiscalYear: number, millions: Record<string, number>): StatementYear => {
  const terms = new Proxy({} as StatementYear["terms"], {
    get: (_, key: string) => (key in millions ? filed(millions[key]! * 1e6) : gapFigure),
  });
  return { fiscalYear, startOn: "", endOn: "", terms };
};

const costco2025 = yearOf(2025, {
  revenue: 275_235,
  costOfRevenue: 239_886,
  grossProfit: 35_349,
  sellingGeneralAndAdministrative: 24_966,
  operatingIncome: 10_383,
  incomeTax: 2_719,
  netIncome: 8_099,
  operatingCashFlow: 13_335,
  depreciationAndAmortization: 2_426,
  stockBasedCompensation: 860,
  capitalExpenditure: 5_498,
  dividends: 2_183,
  shareBuybacks: 903,
  debtRepaid: 103,
});
const costco2026 = yearOf(2026, {
  revenue: 303_154,
  costOfRevenue: 264_279,
  grossProfit: 38_875,
  sellingGeneralAndAdministrative: 27_190,
  operatingIncome: 11_685,
  incomeTax: 3_025,
  netIncome: 9_226,
  operatingCashFlow: 15_817,
  depreciationAndAmortization: 2_674,
  stockBasedCompensation: 924,
  capitalExpenditure: 6_435,
  dividends: 2_458,
  shareBuybacks: 848,
  debtRepaid: 69,
});

describe("each dollar of revenue", () => {
  it("splits tax from interest, which Costco earns more of than it pays", () => {
    const values = profitValues(costco2026)!;
    expect(values.tax).toBeCloseTo(1.0, 2);
    expect(values.interestIn).toBeCloseTo(0.19, 2);
    expect(values.interestOut).toBe(0);
    expect(values.net).toBeCloseTo(3.04, 2);
  });

  it("keeps what reaches net income equal to net income", () => {
    const values = profitValues(costco2026)!;
    expect(values["operating>net"]! + values["interestIn>net"]!).toBeCloseTo(values.net!, 6);
  });

  it("shows the whole stretch below operating income as one part without income tax", () => {
    const values = profitValues(
      yearOf(2026, {
        revenue: 100,
        grossProfit: 40,
        operatingIncome: 20,
        netIncome: 15,
      }),
    )!;
    expect(values.taxKnown).toBe(0);
    expect(values.interestOut).toBeCloseTo(5, 6);
  });
});

describe("the cash", () => {
  it("balances what came in with where it went", () => {
    const values = cashValues(costco2026)!;
    const uses = ["tied", "capex", "acquisitions", "dividends", "buybacks", "debt", "left"];
    expect(uses.reduce((sum, id) => sum + values[id]!, 0)).toBeCloseTo(values.pool!, 0);
    expect(values.left).toBeCloseTo(6_007e6, -6);
  });

  it("has nothing to follow without operating cash flow", () => {
    expect(cashValues(yearOf(2026, { revenue: 100 }))).toBeNull();
  });
});

describe("reading a part", () => {
  it("says what moved net income most", () => {
    const reading = readPart("profit", "net", [costco2025, costco2026], 2026)!;
    expect(reading.verdict.strong?.text).toBe("0.10¢ more");
    expect(reading.verdict.after).toContain("Selling, general and administrative moved it most");
  });

  it("calls a cost that took less of each dollar better", () => {
    const reading = readPart("profit", "selling", [costco2025, costco2026], 2026)!;
    expect(reading.verdict.strong).toEqual({
      text: "0.10¢ less",
      tone: "better",
    });
  });
});
