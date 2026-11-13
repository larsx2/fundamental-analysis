import { describe, expect, it } from "vitest";
import { changeOf, grewText, netIncomeMove } from "./words";

describe("the change under a key figure", () => {
  it("shows dollars and per-share figures as a percent of last year", () => {
    expect(changeOf("money", 105, 100)).toBe("+5.0%");
    expect(changeOf("money", 95, 100)).toBe("−5.0%");
    expect(changeOf("perShare", 6.13, 5.67)).toBe("+8.1%");
  });

  it("shows a margin as points, not as a percent of a percent", () => {
    expect(changeOf("ratio", 0.47, 0.45)).toBe("+2.0 points");
    expect(changeOf("ratio", 0.43, 0.45)).toBe("−2.0 points");
    expect(changeOf("ratio", 0.46, 0.45)).toBe("+1.0 point");
    expect(changeOf("money", 0.47, 0.45)).toBe("+4.4%");
  });

  it("calls a move under five hundredths of a percent, or of a point, unchanged", () => {
    expect(changeOf("money", 100.04, 100)).toBe("unchanged");
    expect(changeOf("money", 99.96, 100)).toBe("unchanged");
    expect(changeOf("money", 100, 100)).toBe("unchanged");
    expect(changeOf("money", 100.06, 100)).toBe("+0.1%");
    expect(changeOf("ratio", 0.4504, 0.45)).toBe("unchanged");
    expect(changeOf("ratio", 0.4496, 0.45)).toBe("unchanged");
    expect(changeOf("ratio", 0.4506, 0.45)).toBe("+0.1 points");
  });

  it("gives no percent when the figure turns positive after a loss or to a loss, but still gives points", () => {
    expect(changeOf("money", 5, -2)).toBeNull();
    expect(changeOf("money", -5, 2)).toBeNull();
    expect(changeOf("perShare", 1.5, -0.5)).toBeNull();
    expect(changeOf("ratio", 0.05, -0.02)).toBe("+7.0 points");
  });

  it("gives nothing when this year or last year is missing, or last year was zero", () => {
    expect(changeOf("money", null, 100)).toBeNull();
    expect(changeOf("money", 100, null)).toBeNull();
    expect(changeOf("money", null, null)).toBeNull();
    expect(changeOf("money", 5, 0)).toBeNull();
    expect(changeOf("perShare", null, 5.67)).toBeNull();
    expect(changeOf("ratio", null, 0.45)).toBeNull();
    expect(changeOf("ratio", 0.45, null)).toBeNull();
  });
});

describe("how a figure grew, in words", () => {
  it("says grew or fell with the size of the move", () => {
    expect(grewText(105, 100)).toBe("grew 5.0%");
    expect(grewText(95, 100)).toBe("fell 5.0%");
  });

  it("says stayed the same for a move under five hundredths of a percent", () => {
    expect(grewText(100.04, 100)).toBe("stayed the same");
    expect(grewText(99.96, 100)).toBe("stayed the same");
    expect(grewText(100.06, 100)).toBe("grew 0.1%");
  });

  it("says nothing when a figure is missing or changes sign", () => {
    expect(grewText(null, 100)).toBeNull();
    expect(grewText(100, null)).toBeNull();
    expect(grewText(5, -2)).toBeNull();
  });
});

describe("how net income moved, in words", () => {
  it("uses the growth rate while both years are profits", () => {
    expect(netIncomeMove(120, 100)).toBe("grew 20.0%");
    expect(netIncomeMove(80, 100)).toBe("fell 20.0%");
    expect(netIncomeMove(100.04, 100)).toBe("stayed the same");
  });

  it("says what happened instead when a loss is on either side", () => {
    expect(netIncomeMove(10, -5)).toBe("turned positive after a loss");
    expect(netIncomeMove(5, 0)).toBe("turned positive after a loss");
    expect(netIncomeMove(-5, 10)).toBe("turned to a loss");
    expect(netIncomeMove(0, 10)).toBe("turned to a loss");
    expect(netIncomeMove(-5, -3)).toBe("was a loss again");
    expect(netIncomeMove(0, 0)).toBe("was a loss again");
  });

  it("says nothing when a year is missing", () => {
    expect(netIncomeMove(null, 10)).toBeNull();
    expect(netIncomeMove(10, null)).toBeNull();
    expect(netIncomeMove(null, null)).toBeNull();
  });
});
