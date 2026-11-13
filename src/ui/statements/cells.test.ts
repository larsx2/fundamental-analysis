import { describe, expect, it } from "vitest";
import { type CheckedFigure, gapFigure } from "../../shared/figures";
import { changeText, moveCell, shortValue, unitOf, yearWindow } from "./cells";
import type { Row } from "./rows";

const source = {
  tag: "Revenues",
  value: 1,
  accession: "0000320193-23-000106",
  filedOn: "2023-11-03",
};
const reported = (value: number): CheckedFigure => ({
  kind: "reported",
  value,
  latest: source,
  original: source,
  doubtful: null,
});

const revenue: Row = { key: "revenue", term: "Revenue", kind: "total" };
const margin: Row = {
  key: "grossMargin",
  term: "Gross margin",
  kind: "calc",
  unit: "percent",
};
const earnings: Row = {
  key: "earningsPerShare",
  term: "Earnings per share",
  unit: "perShare",
};
const table: ReadonlyArray<Row> = [
  revenue,
  { key: "costOfRevenue", term: "Cost of revenue" },
  margin,
];
const years = [2021, 2022, 2023, 2024].map((fiscalYear) => ({ fiscalYear }));

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe("the ten years the table shows", () => {
  const twenty = range(2005, 2024);

  it("starts at the chosen year when it is among the first ten", () => {
    expect(yearWindow(twenty, 2005)).toEqual(range(2005, 2014));
  });

  it("starts at the chosen year in the middle of a long history", () => {
    expect(yearWindow(twenty, 2012)).toEqual(range(2012, 2021));
  });

  it("ends at the newest year when the chosen year is among the last ten", () => {
    expect(yearWindow(twenty, 2019)).toEqual(range(2015, 2024));
    expect(yearWindow(twenty, 2024)).toEqual(range(2015, 2024));
  });

  it("shows every year when there are fewer than ten", () => {
    expect(yearWindow(range(2020, 2024), 2022)).toEqual(range(2020, 2024));
  });

  it("starts at the oldest year when the chosen year is not in the list", () => {
    expect(yearWindow(twenty, 1999)).toEqual(range(2005, 2014));
  });
});

describe("moving between numbers with the keyboard", () => {
  const from = (key: Row["key"], fiscalYear: number, press: string) =>
    moveCell(table, years, { key, fy: fiscalYear }, press);

  it("moves one number at a time with the arrow keys", () => {
    expect(from("costOfRevenue", 2022, "ArrowLeft")).toEqual({
      key: "costOfRevenue",
      fy: 2021,
    });
    expect(from("costOfRevenue", 2022, "ArrowRight")).toEqual({
      key: "costOfRevenue",
      fy: 2023,
    });
    expect(from("costOfRevenue", 2022, "ArrowUp")).toEqual({
      key: "revenue",
      fy: 2022,
    });
    expect(from("costOfRevenue", 2022, "ArrowDown")).toEqual({
      key: "grossMargin",
      fy: 2022,
    });
  });

  it("jumps to the first or last year of the line with Home and End", () => {
    expect(from("costOfRevenue", 2022, "Home")).toEqual({
      key: "costOfRevenue",
      fy: 2021,
    });
    expect(from("costOfRevenue", 2022, "End")).toEqual({
      key: "costOfRevenue",
      fy: 2024,
    });
  });

  it("stops at the edges of the table", () => {
    expect(from("revenue", 2021, "ArrowLeft")).toEqual({
      key: "revenue",
      fy: 2021,
    });
    expect(from("revenue", 2021, "ArrowUp")).toEqual({
      key: "revenue",
      fy: 2021,
    });
    expect(from("grossMargin", 2024, "ArrowRight")).toEqual({
      key: "grossMargin",
      fy: 2024,
    });
    expect(from("grossMargin", 2024, "ArrowDown")).toEqual({
      key: "grossMargin",
      fy: 2024,
    });
    expect(from("revenue", 2021, "Home")).toEqual({ key: "revenue", fy: 2021 });
    expect(from("grossMargin", 2024, "End")).toEqual({
      key: "grossMargin",
      fy: 2024,
    });
  });

  it("leaves other keys alone", () => {
    expect(from("revenue", 2022, "Enter")).toBeNull();
    expect(from("revenue", 2022, "Tab")).toBeNull();
  });
});

describe("what a line is measured in", () => {
  it("takes the unit a line names, then percent for the margins, then money", () => {
    expect(unitOf(earnings)).toBe("perShare");
    expect(unitOf({ key: "netMargin", term: "Net margin" })).toBe("percent");
    expect(unitOf(revenue)).toBe("money");
  });

  it("writes a short figure in the unit of its line", () => {
    expect(shortValue(revenue, 383285000000)).toBe("$383.3B");
    expect(shortValue(revenue, -12000000)).toBe("−$12M");
    expect(shortValue(margin, 0.456)).toBe("45.6%");
    expect(shortValue(earnings, 6.13)).toBe("$6.13");
  });
});

describe("the change from one year to the next", () => {
  it("is a percent of the earlier year for money", () => {
    expect(changeText(revenue, reported(110), reported(100))).toBe("+10.0%");
    expect(changeText(revenue, reported(90), reported(100))).toBe("−10.0%");
    expect(changeText(revenue, reported(100), reported(100))).toBe("0.0%");
  });

  it("is a percent only where both years have the same sign", () => {
    expect(changeText(revenue, reported(5), reported(-5))).toBeNull();
    expect(changeText(revenue, reported(5), reported(0))).toBeNull();
  });

  it("is in points for a margin, even across zero", () => {
    expect(changeText(margin, reported(0.45), reported(0.4))).toBe("+5.0 points");
    expect(changeText(margin, reported(0.4), reported(0.45))).toBe("−5.0 points");
    expect(changeText(margin, reported(0.41), reported(0.4))).toBe("+1.0 point");
    expect(changeText(margin, reported(-0.05), reported(0.05))).toBe("−10.0 points");
  });

  it("is missing when either year has no figure", () => {
    expect(changeText(revenue, reported(110), undefined)).toBeNull();
    expect(changeText(revenue, gapFigure, reported(100))).toBeNull();
    expect(changeText(revenue, reported(110), gapFigure)).toBeNull();
    expect(changeText(margin, reported(0.45), undefined)).toBeNull();
    expect(changeText(margin, gapFigure, reported(0.4))).toBeNull();
  });
});
