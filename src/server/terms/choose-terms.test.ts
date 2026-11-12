import { describe, expect, it } from "@effect/vitest";
import {
  chooseTerms,
  grossProfitCheck,
  type NumberRow,
  operatingIncomeCheck,
} from "./choose-terms";

const row = (tag: string, fiscalYear: number, value: number, filedOn = `${fiscalYear}-10-30`) => ({
  tag,
  fiscalYear,
  value,
  filedOn,
  accession: `0000000001-${filedOn}`,
});

const yearOf = (rows: ReadonlyArray<NumberRow>, fiscalYear: number) =>
  chooseTerms(rows).fiscalYears.find((year) => year.fiscalYear === fiscalYear)!.terms;

describe("chooseTerms", () => {
  it("chooses the latest restated number and keeps the original", () => {
    const terms = yearOf(
      [
        row("Revenues", 2016, 85_320, "2016-07-28"),
        row("Revenues", 2016, 91_154, "2018-08-03"),
        row("Revenues", 2016, 91_154, "2017-08-02"),
      ],
      2016,
    );
    expect(terms.revenue).toMatchObject({
      value: 91_154,
      latest: { filedOn: "2018-08-03" },
      original: { value: 85_320, filedOn: "2016-07-28" },
    });
  });

  it("uses the first tag on the list that has a value for the year", () => {
    const terms = yearOf(
      [
        row("SalesRevenueNet", 2016, 85_320),
        row("RevenueFromContractWithCustomerExcludingAssessedTax", 2016, 91_154),
      ],
      2016,
    );
    expect(terms.revenue).toMatchObject({
      value: 91_154,
      latest: { tag: "RevenueFromContractWithCustomerExcludingAssessedTax" },
    });
  });

  it("never uses a tag that covers only part of a term", () => {
    const terms = yearOf(
      [row("Revenues", 2014, 86_833), row("SalesRevenueGoodsNet", 2015, 75_956)],
      2014,
    );
    expect(chooseTerms([row("SalesRevenueGoodsNet", 2015, 75_956)]).fiscalYears).toEqual([]);
    expect(terms.revenue).toMatchObject({ value: 86_833 });
  });

  it("calculates gross profit when it is not reported, keeping what it was made from", () => {
    const terms = yearOf(
      [row("Revenues", 2023, 242_290), row("CostOfGoodsAndServicesSold", 2023, 212_586)],
      2023,
    );
    expect(terms.grossProfit).toEqual({
      kind: "calculated",
      value: 29_704,
      from: [
        { name: "Revenue", value: 242_290 },
        { name: "Cost of revenue", value: -212_586 },
      ],
      setAside: null,
      doubtful: null,
    });
  });

  it("adds selling, general and administrative up from its two parts", () => {
    const terms = yearOf(
      [
        row("Revenues", 2023, 211_915),
        row("SellingAndMarketingExpense", 2023, 22_759),
        row("GeneralAndAdministrativeExpense", 2023, 7_575),
      ],
      2023,
    );
    expect(terms.sellingGeneralAndAdministrative).toMatchObject({
      kind: "calculated",
      value: 30_334,
    });
  });

  it("leaves a term the company never reports as a gap, not zero", () => {
    const terms = yearOf([row("Revenues", 2023, 242_290)], 2023);
    expect(terms.researchAndDevelopment).toEqual({
      kind: "gap",
      doubtful: null,
    });
  });

  it("uses revenue minus cost of revenue when a filed gross profit disagrees, keeping the filed one as doubtful", () => {
    const terms = yearOf(
      [
        row("Revenues", 2019, 152_703),
        row("CostOfGoodsAndServicesSold", 2019, 132_886),
        row("GrossProfit", 2019, 16_465),
      ],
      2019,
    );
    expect(terms.grossProfit).toMatchObject({
      kind: "calculated",
      value: 19_817,
      setAside: { value: 16_465, doubtful: grossProfitCheck },
    });
  });

  it("shows what lies between the named expenses and operating income as other operating expenses", () => {
    const terms = yearOf(
      [
        row("Revenues", 2015, 93_580),
        row("CostOfRevenue", 2015, 33_038),
        row("GrossProfit", 2015, 60_542),
        row("ResearchAndDevelopmentExpense", 2015, 12_046),
        row("SellingGeneralAndAdministrativeExpense", 2015, 20_324),
        row("OperatingIncomeLoss", 2015, 18_161),
      ],
      2015,
    );
    expect(terms.otherOperatingExpenses).toMatchObject({ kind: "calculated", value: 10_011 });
    expect(terms.operatingIncome.doubtful).toBeNull();
  });

  it("checks operating income against the reported total operating expenses, within a rounding allowance", () => {
    const base = [
      row("Revenues", 2015, 93_580),
      row("CostOfRevenue", 2015, 33_038),
      row("GrossProfit", 2015, 60_542),
      row("OperatingExpenses", 2015, 42_381),
    ];
    const roundedOff = yearOf([...base, row("OperatingIncomeLoss", 2015, 18_162)], 2015);
    const wrong = yearOf([...base, row("OperatingIncomeLoss", 2015, 28_161)], 2015);
    expect(roundedOff.operatingIncome.doubtful).toBeNull();
    expect(wrong.operatingIncome.doubtful).toBe(operatingIncomeCheck);
  });

  it("reports related tags that are on no list", () => {
    const { unlisted } = chooseTerms([
      row("Revenues", 2023, 383_285),
      row("RevenueFromLeases", 2022, 1_000),
      row("RevenueFromLeases", 2023, 1_200),
    ]);
    expect(unlisted).toEqual([
      { term: "revenue", tag: "RevenueFromLeases", fiscalYears: [2022, 2023] },
    ]);
  });
});
