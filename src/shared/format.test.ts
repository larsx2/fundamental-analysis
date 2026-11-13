import { describe, expect, it } from "vitest";
import { centsOfDollar, money, yearEndInWords } from "./format";

describe("money in words", () => {
  // Apple.s fiscal 2023, from its annual report (10-K): revenue of $383,285
  // million and $5,228 million of debt raised.
  it("shows one decimal from ten billion, two below it, and whole millions below one billion", () => {
    expect(money(383_285_000_000)).toBe("$383.3 billion");
    expect(money(5_228_000_000)).toBe("$5.23 billion");
    expect(money(-5_228_000_000)).toBe("−$5.23 billion");
    expect(money(960_400_000)).toBe("$960 million");
    expect(money(0)).toBe("$0");
  });
});

describe("cents of each dollar of revenue", () => {
  // Apple's fiscal 2023 in millions of dollars: revenue 383,285, cost of revenue
  // 214,137, research and development 29,915, selling, general and
  // administrative 24,932, nothing else operating, 17,306 between operating
  // income and net income, and 96,995 of net income. The look and feel RFC
  // reads it as 56, 8, 6, 5 and 25 cents.
  it("rounds so the parts add up to a dollar, as a reader checks them", () => {
    const cents = centsOfDollar([214_137, 29_915, 24_932, 0, 17_306, 96_995], 383_285);
    expect(cents).toEqual([56, 8, 6, 0, 5, 25]);
    expect(cents.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("when a fiscal year ends, in words", () => {
  // Costco's fiscal year ends on the Sunday nearest 31 August, so some years
  // end in early September. These are its year ends from fiscal 2008 to
  // fiscal 2026, from its annual reports (10-K).
  it("does not call a year that sometimes ends in September late August", () => {
    const costco = [
      "2008-08-31",
      "2009-08-30",
      "2010-08-29",
      "2011-08-28",
      "2012-09-02",
      "2013-09-01",
      "2014-08-31",
      "2015-08-30",
      "2016-08-28",
      "2017-09-03",
      "2018-09-02",
      "2019-09-01",
      "2020-08-30",
      "2021-08-29",
      "2022-08-28",
      "2023-09-03",
      "2024-09-01",
      "2025-08-31",
      "2026-08-30",
    ];
    expect(yearEndInWords(costco)).toBe("around the end of August");
  });
});
