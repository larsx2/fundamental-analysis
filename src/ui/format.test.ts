import { describe, expect, it } from "vitest";
import { centsOfDollar } from "./format";

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
