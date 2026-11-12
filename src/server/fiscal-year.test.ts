import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { fiscalYearOf } from "./fiscal-year";

describe("fiscalYearOf", () => {
  it("names a year by the calendar year it ends in, whatever its length", () => {
    expect(fiscalYearOf({ start: "2022-09-25", end: "2023-09-30" })).toEqual(Option.some(2023));
    expect(fiscalYearOf({ start: "2022-07-01", end: "2023-06-30" })).toEqual(Option.some(2023));
    expect(fiscalYearOf({ start: "2022-08-29", end: "2023-09-03" })).toEqual(Option.some(2023));
    expect(fiscalYearOf({ start: "2023-09-04", end: "2024-09-01" })).toEqual(Option.some(2024));
  });

  it("does not count a quarter or nine months as a fiscal year", () => {
    expect(fiscalYearOf({ start: "2023-07-02", end: "2023-09-30" })).toEqual(Option.none());
    expect(fiscalYearOf({ start: "2022-10-01", end: "2023-07-01" })).toEqual(Option.none());
  });

  it("gives a balance at a single date the year of that date", () => {
    expect(fiscalYearOf({ end: "2023-09-30" })).toEqual(Option.some(2023));
  });
});
