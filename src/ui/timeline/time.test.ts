import { describe, expect, it } from "vitest";
import {
  type EconomyMonth,
  fiscalOf,
  middle,
  monthAfterKey,
  nearestMonth,
  recessionRuns,
  type Span,
  yearLabelShown,
} from "./time";

const month = (name: string, recession = false): EconomyMonth => ({
  month: name,
  interestRate: 1,
  inflation: 2,
  recession,
});

const months = ["2023-01", "2023-02", "2023-03", "2023-04", "2023-05"].map((name) => month(name));

describe("the timeline's months", () => {
  it("groups recession months into unbroken runs", () => {
    const list = [
      month("2008-01", true),
      month("2008-02", true),
      month("2008-03"),
      month("2008-04", true),
      month("2008-05"),
      month("2008-06", true),
    ];
    expect(recessionRuns(list)).toEqual([["2008-01", "2008-02"], ["2008-04"], ["2008-06"]]);
  });

  it("finds the month nearest a date, and none when there are no months", () => {
    expect(nearestMonth(months, new Date(Date.UTC(2023, 1, 20)))).toBe("2023-02");
    expect(nearestMonth(months, new Date(Date.UTC(2030, 0, 1)))).toBe("2023-05");
    expect(nearestMonth([], new Date())).toBeNull();
  });

  it("moves a month with the arrows and a year with Page Up and Page Down, within the months held", () => {
    expect(monthAfterKey("ArrowLeft", 2, months)).toBe("2023-02");
    expect(monthAfterKey("ArrowUp", 2, months)).toBe("2023-04");
    expect(monthAfterKey("PageUp", 2, months)).toBe("2023-05");
    expect(monthAfterKey("PageDown", 2, months)).toBe("2023-01");
    expect(monthAfterKey("Home", 2, months)).toBe("2023-01");
    expect(monthAfterKey("End", 0, months)).toBe("2023-05");
  });

  it("leaves other keys, and an empty timeline, to the browser", () => {
    expect(monthAfterKey("Tab", 2, months)).toBeNull();
    expect(monthAfterKey("ArrowLeft", 0, [])).toBeNull();
  });
});

describe("the timeline's fiscal years", () => {
  const span = (fiscalYear: number, start: string, end: string) =>
    ({
      fiscalYear,
      start: new Date(`${start}T12:00:00Z`),
      end: new Date(`${end}T12:00:00Z`),
    }) as Span;
  const spans = [span(2022, "2021-09-26", "2022-09-24"), span(2023, "2022-09-25", "2023-09-30")];

  it("places a month in the fiscal year its middle falls in", () => {
    expect(fiscalOf(spans, middle("2022-09"))?.fiscalYear).toBe(2022);
    expect(fiscalOf(spans, middle("2022-10"))?.fiscalYear).toBe(2023);
    expect(fiscalOf(spans, middle("2024-01"))).toBeUndefined();
  });

  it("names every year when there is room, and every other one and the chosen one when not", () => {
    expect([0, 1, 2, 3, 4, 5].filter(yearLabelShown(false, 2, 5))).toEqual([0, 1, 2, 3, 4, 5]);
    expect([0, 1, 2, 3, 4, 5].filter(yearLabelShown(true, 2, 5))).toEqual([2, 5]);
    expect([0, 1, 2, 3, 4, 5].filter(yearLabelShown(true, 5, 5))).toEqual([1, 3, 5]);
  });
});
