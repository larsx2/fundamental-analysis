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

  it("names a year that ends in the first days of January by the year before", () => {
    expect(fiscalYearOf({ start: "2019-12-29", end: "2021-01-02" })).toEqual(Option.some(2020));
    expect(fiscalYearOf({ start: "2021-01-03", end: "2022-01-01" })).toEqual(Option.some(2021));
    expect(fiscalYearOf({ start: "2022-01-02", end: "2022-12-31" })).toEqual(Option.some(2022));
  });

  // A fiscal year is 52 or 53 weeks, or a calendar year.
  it("does not count fifty weeks or fifty-five weeks as a fiscal year", () => {
    expect(fiscalYearOf({ start: "2022-10-16", end: "2023-09-30" })).toEqual(Option.none());
    expect(fiscalYearOf({ start: "2022-09-11", end: "2023-09-30" })).toEqual(Option.none());
  });

  it("does not count a quarter, nine months or eleven months as a fiscal year", () => {
    expect(fiscalYearOf({ start: "2023-07-02", end: "2023-09-30" })).toEqual(Option.none());
    expect(fiscalYearOf({ start: "2022-10-01", end: "2023-07-01" })).toEqual(Option.none());
    expect(fiscalYearOf({ start: "2022-11-01", end: "2023-09-30" })).toEqual(Option.none());
  });

  it("gives a balance at a single date the year of that date", () => {
    expect(fiscalYearOf({ end: "2023-09-30" })).toEqual(Option.some(2023));
  });
});
