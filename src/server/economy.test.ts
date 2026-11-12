import { describe, expect, it } from "vitest";
import { economyMonths, parseFredCsv } from "./economy";

// FRED's files, trimmed: consumer prices in June 2021 and June 2022, when US
// inflation peaked at about 9%, and an empty month, as FRED writes October
// 2025, when no prices were published.
const prices = `observation_date,CPIAUCSL
2021-06-01,271.696
2021-07-01,
2022-06-01,296.311
2022-07-01,297.0
`;
const rates = `observation_date,FEDFUNDS
2022-06-01,1.21
2022-07-01,1.68
`;
const recessions = `observation_date,USREC
2022-06-01,0
2022-07-01,0
`;

describe("economic context from the US central bank's data", () => {
  it("counts inflation against prices twelve months before, and leaves a missing month as a gap", () => {
    const months = economyMonths({
      interestRate: parseFredCsv(rates),
      prices: parseFredCsv(prices),
      recession: parseFredCsv(recessions),
    });
    expect(months.map((month) => [month.month, month.inflation])).toEqual([
      ["2022-06", 9.1],
      ["2022-07", null],
    ]);
  });
});
