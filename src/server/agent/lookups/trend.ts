import { compoundAnnualGrowthRate } from "../../../shared/company-summary";
import { type CheckedFigure, valueOf } from "../../../shared/figures";
import type { Drawing, LookupResult, Series, Unit } from "../../../shared/lookups";
import {
  lowerFirst,
  percent,
  signedPercent,
  signedPoints,
  yearOverYear,
} from "../../../shared/format";
import { figureOf, keyOfTerm, ratioKeys } from "../../../shared/figure-keys";
import type { StatementYear } from "../../terms/statements";
import {
  type CompanyData,
  LookupProblem,
  recent,
  first,
  last,
  span,
  filingsOf,
  unitOf,
  writeValue,
  recessionYears,
  risingRateYears,
  shadesFor,
} from "./common";

export const trendTerms = Object.keys(keyOfTerm).filter(
  (name) => name !== "Interest, other income and tax",
);

const toneOf = (name: string, index: number): Series["tone"] =>
  name === "Net income" ? "kept" : name === "Revenue" ? "white" : index % 2 === 0 ? "soft" : "grey";

const listNames = (names: ReadonlyArray<string>) => {
  const words = names.map((name, index) => (index === 0 ? name : lowerFirst(name)));
  return words.length < 2
    ? (words[0] ?? "")
    : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
};

export const trend = (
  data: CompanyData,
  input: {
    readonly terms: ReadonlyArray<string>;
    readonly shareOfRevenue: boolean;
    readonly economy: boolean;
  },
): LookupResult => {
  const unknown = input.terms.filter((name) => keyOfTerm[name] === undefined);
  if (unknown.length > 0 || input.terms.length === 0) {
    throw new LookupProblem({
      message: `Use glossary terms from this list: ${trendTerms.join(", ")}. Not on it: ${unknown.join(", ") || "no term given"}.`,
    });
  }
  const list = recent(data);
  const figures: Record<string, string> = {};
  const notes: Array<string> = [];
  const used: Array<CheckedFigure> = [];
  const series: Array<Series> = [];
  let units = new Set<Unit>();

  input.terms.forEach((name, index) => {
    const key = keyOfTerm[name]!;
    const asShare = input.shareOfRevenue && !ratioKeys.has(key) && key !== "earningsPerShare";
    const unit = unitOf(key, asShare);
    units = units.add(unit);
    const label = asShare
      ? `${name} as a share of revenue`
      : name === "Margin"
        ? "Net income as a share of revenue"
        : name;
    const read = (year: StatementYear) => {
      const figure = figureOf(year, key);
      const value = valueOf(figure);
      if (!asShare) return value;
      const revenue = valueOf(year.terms.revenue);
      return value === null || revenue === null || revenue === 0 ? null : value / revenue;
    };
    const points = list.map((year) => ({
      fiscalYear: year.fiscalYear,
      value: read(year),
    }));
    series.push({
      name: label,
      term: name === "Margin" ? "Margin" : name,
      tone: toneOf(name, index),
      ...(index === 1 && name !== "Net income" ? { dashed: true } : {}),
      points,
    });
    used.push(figureOf(first(list), key), figureOf(last(list), key));

    for (const point of points) {
      figures[`${label}, fiscal ${point.fiscalYear}`] =
        point.value === null ? "gap" : writeValue(unit, point.value);
    }
    let rises = 0;
    let falls = 0;
    let largestRise: { at: number; text: string; size: number } | null = null;
    let largestFall: { at: number; text: string; size: number } | null = null;
    points.forEach((point, at) => {
      const before = points[at - 1];
      if (before === undefined) return;
      const size =
        unit === "share"
          ? point.value === null || before.value === null
            ? null
            : (point.value - before.value) * 100
          : yearOverYear(point.value, before.value);
      if (size === null) return;
      const text = unit === "share" ? signedPoints(size) : signedPercent(size);
      figures[`${label}, change in fiscal ${point.fiscalYear}`] = text;
      if (size > 0) rises += 1;
      if (size < 0) falls += 1;
      if (largestRise === null || size > largestRise.size) {
        largestRise = { at: point.fiscalYear, text, size };
      }
      if (largestFall === null || size < largestFall.size) {
        largestFall = { at: point.fiscalYear, text, size };
      }
    });
    const changes = rises + falls;
    if (changes > 0) {
      figures[`${label}, fiscal years it rose`] = `${rises} of ${points.length - 1}`;
      figures[`${label}, fiscal years it fell`] = `${falls} of ${points.length - 1}`;
    }
    const rise = largestRise as {
      at: number;
      text: string;
      size: number;
    } | null;
    const fall = largestFall as {
      at: number;
      text: string;
      size: number;
    } | null;
    if (rise !== null && rise.size > 0) {
      figures[`${label}, largest rise`] = `${rise.text} in fiscal ${rise.at}`;
    }
    if (fall !== null && fall.size < 0) {
      figures[`${label}, largest fall`] = `${fall.text} in fiscal ${fall.at}`;
    }

    const known = points.filter((point) => point.value !== null);
    const start = known[0];
    const end = known.at(-1);
    if (start !== undefined && end !== undefined && start !== end) {
      const range = `from fiscal ${start.fiscalYear} to fiscal ${end.fiscalYear}`;
      if (unit === "share") {
        figures[`${label}, change ${range}`] = signedPoints((end.value! - start.value!) * 100);
      } else {
        const whole = yearOverYear(end.value, start.value);
        if (whole !== null) figures[`${label}, change ${range}`] = signedPercent(whole);
        const growth = compoundAnnualGrowthRate(
          start.value,
          end.value,
          end.fiscalYear - start.fiscalYear,
        );
        if (growth !== null) {
          figures[`${label}, compound annual growth rate ${range}`] = percent(growth);
        }
      }
    }
    const gaps = points.filter((point) => point.value === null).map((point) => point.fiscalYear);
    if (gaps.length > 0) {
      notes.push(
        `${label} is a gap in fiscal ${gaps.join(", ")}: not reported as its own line. A gap is never zero.`,
      );
    }
  });

  const shade = input.economy ? shadesFor(data) : [];
  if (input.economy) {
    const recession = recessionYears(data);
    const rising = risingRateYears(data);
    figures["Fiscal years a recession touched"] =
      recession.length === 0 ? "none" : recession.join(", ");
    figures["Fiscal years the interest rate rose by more than a point"] =
      rising.length === 0 ? "none" : rising.join(", ");
    notes.push("One company's years show what happened at the same time, not what caused what.");
  }

  const unit: Unit = units.size === 1 ? first([...units]) : "money";
  const drawing: Drawing = {
    kind: "lines",
    title: `${listNames(series.map((each) => each.name))}, ${span(list)}`,
    unit,
    apart: unit === "money" && series.length > 1,
    series,
    shade: shade.filter(
      (each) =>
        each.fiscalYear >= first(list).fiscalYear && each.fiscalYear <= last(list).fiscalYear,
    ),
  };
  return {
    lookup: "trend",
    title: `${listNames(series.map((each) => each.name))}, ${span(list)}`,
    detail: `${list.length} fiscal years, with every change worked out by the tool`,
    figures,
    notes,
    drawing,
    filings: filingsOf(data.cik, used),
  };
};
