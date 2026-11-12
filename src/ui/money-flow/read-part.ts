import type { StatementYear } from "../../functions/company";
import { moneyShort } from "../format";
import { cents, type Lens, nameOf, partsOf, termOf, valuesOf } from "./flows";

export type Tone = "better" | "worse" | "";

export type Verdict = {
  readonly before: string;
  readonly strong?: { readonly text: string; readonly tone: Tone };
  readonly after?: string;
};

export type PartReading = {
  readonly name: string;
  readonly term: string;
  readonly about: string | null;
  readonly color: string;
  readonly big: string;
  readonly sub: string;
  readonly verdict: Verdict;
  readonly stats: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
    readonly tone: Tone;
  }>;
  readonly series: ReadonlyArray<{
    readonly fiscalYear: number;
    readonly value: number;
  }>;
  readonly current: number;
  readonly average: number;
  readonly unit: "cents" | "dollars";
};

const minus = "−";
const signed = (text: string, value: number) => `${value >= 0 ? "+" : minus}${text}`;
const pct = (value: number) => signed(`${Math.abs(value).toFixed(1)}%`, value);
const centsChange = (value: number) => signed(`${Math.abs(value).toFixed(2)}¢`, value);
const tone = (good: boolean): Tone => (good ? "better" : "worse");

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

export function readPart(
  lens: Lens,
  id: string,
  years: ReadonlyArray<StatementYear>,
  fiscalYear: number,
): PartReading | null {
  const part = partsOf(lens).find((each) => each.id === id);
  if (part === undefined) return null;
  const all = years
    .map((year) => ({ year, values: valuesOf(lens, year) }))
    .filter(
      (each): each is { year: StatementYear; values: Record<string, number> } =>
        each.values !== null,
    );
  const at = all.findIndex((each) => each.year.fiscalYear === fiscalYear);
  if (at === -1) return null;
  const now = all[at]!;
  const before = all[at - 1];
  const inCents = lens === "profit" && id !== "revenue";
  const valueIn = (values: Record<string, number>) =>
    lens === "profit" && id === "revenue"
      ? (values.revenueDollars ?? 0)
      : (values[`signed:${id}`] ?? values[id] ?? 0);
  const series = all.map((each) => ({
    fiscalYear: each.year.fiscalYear,
    value: valueIn(each.values),
  }));
  const value = valueIn(now.values);
  const average = series.reduce((sum, each) => sum + each.value, 0) / series.length;
  const rank =
    [...series]
      .sort((a, b) => b.value - a.value)
      .findIndex((each) => each.fiscalYear === fiscalYear) + 1;
  const rankText = `${ordinal(rank)} of ${series.length}`;
  const name = nameOf(lens, id, now.values);
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  const base = {
    name,
    term: termOf(lens, id, now.values),
    about: part.about ?? null,
    color: part.total ? "var(--color-flow-total)" : part.color,
    series,
    current: fiscalYear,
    average,
    unit: inCents ? ("cents" as const) : ("dollars" as const),
  };

  if (lens === "profit" && id === "revenue") {
    const first = series[0]!;
    const span = fiscalYear - first.fiscalYear;
    const yearly = span > 0 ? (Math.pow(value / first.value, 1 / span) - 1) * 100 : null;
    const grew = before === undefined ? null : (value / valueIn(before.values) - 1) * 100;
    return {
      ...base,
      big: moneyShort(value),
      sub: `Fiscal ${fiscalYear}`,
      verdict:
        grew === null
          ? {
              before: "The first year shown, so there is nothing to compare with.",
            }
          : {
              before: `Revenue grew `,
              strong: {
                text: `${Math.abs(grew).toFixed(1)}%`,
                tone: tone(grew >= 0),
              },
              after:
                yearly === null
                  ? ` on fiscal ${before!.year.fiscalYear}.`
                  : `, ${grew > yearly ? "faster" : "slower"} than its ${yearly.toFixed(1)}% a year since fiscal ${first.fiscalYear}.`,
            },
      stats: [
        ...(grew === null
          ? []
          : [
              {
                label: `On fiscal ${before!.year.fiscalYear}`,
                value: pct(grew),
                tone: tone(grew >= 0),
              },
            ]),
        ...(yearly === null
          ? []
          : [
              {
                label: `A year since ${first.fiscalYear}`,
                value: pct(yearly),
                tone: "" as Tone,
              },
            ]),
      ],
    };
  }

  if (lens === "profit") {
    const revenue = now.values.revenueDollars ?? 0;
    const dollars = (value / 100) * revenue;
    const big = `${id === "interestIn" ? "+" : ""}${cents(value)}`;
    const sub = `${moneyShort(dollars)} in fiscal ${fiscalYear}`;
    if (before === undefined) {
      return {
        ...base,
        big,
        sub,
        verdict: {
          before: "The first year shown, so there is nothing to compare with.",
        },
        stats: [{ label: "Rank, highest first", value: rankText, tone: "" }],
      };
    }
    const was = valueIn(before.values);
    const revenueBefore = before.values.revenueDollars ?? 0;
    const dollarsBefore = (was / 100) * revenueBefore;
    const change = value - was;
    const grew = dollarsBefore === 0 ? 0 : (dollars / dollarsBefore - 1) * 100;
    const sales = (revenue / revenueBefore - 1) * 100;
    const good = part.lowerIsBetter === true ? change < 0 : change > 0;
    const stats = [
      {
        label: `Of each dollar, on ${before.year.fiscalYear}`,
        value: centsChange(change),
        tone: Math.abs(change) < 0.005 ? ("" as Tone) : tone(good),
      },
      {
        label: `In dollars, on ${before.year.fiscalYear}`,
        value: pct(grew),
        tone: "" as Tone,
      },
      { label: "Revenue grew", value: pct(sales), tone: "" as Tone },
      { label: "Rank, highest first", value: rankText, tone: "" as Tone },
    ];
    const amount = `${Math.abs(change).toFixed(2)}¢`;
    const faster = grew > sales;
    if (id === "net") {
      const movers = ["cost", "research", "selling", "other", "tax", "interestOut", "interestIn"]
        .map((each) => ({
          id: each,
          moved:
            (each === "interestIn" ? 1 : -1) *
            ((now.values[each] ?? 0) - (before.values[each] ?? 0)),
        }))
        .sort((a, b) => Math.abs(b.moved) - Math.abs(a.moved));
      const top = movers[0]!;
      const topName = nameOf(lens, top.id, now.values);
      return {
        ...base,
        big,
        sub,
        verdict: {
          before: "Net income was ",
          strong: {
            text: `${amount} ${change >= 0 ? "more" : "less"}`,
            tone: tone(change >= 0),
          },
          after: ` of each dollar than in fiscal ${before.year.fiscalYear}. ${topName} moved it most, ${top.moved >= 0 ? "adding" : "taking"} ${Math.abs(top.moved).toFixed(2)}¢.`,
        },
        stats,
      };
    }
    if (part.lowerIsBetter === true) {
      return {
        ...base,
        big,
        sub,
        verdict: {
          before: `It grew ${faster ? "faster" : "slower"} than revenue, so ${lower} took `,
          strong: {
            text: `${amount} ${change >= 0 ? "more" : "less"}`,
            tone: tone(change < 0),
          },
          after: ` of each dollar. That ${change >= 0 ? "took" : "added"} ${amount} ${change >= 0 ? "from" : "to"} net income.`,
        },
        stats,
      };
    }
    return {
      ...base,
      big,
      sub,
      verdict: {
        before: `It grew ${faster ? "faster" : "slower"} than revenue, so it is `,
        strong: {
          text: `${amount} ${change >= 0 ? "more" : "less"}`,
          tone: tone(change >= 0),
        },
        after: ` of each dollar than in fiscal ${before.year.fiscalYear}.`,
      },
      stats,
    };
  }

  const pool = now.values.pool ?? 0;
  const share = pool > 0 ? (value / pool) * 100 : 0;
  const stats: Array<{ label: string; value: string; tone: Tone }> = [];
  if (before !== undefined) {
    const was = valueIn(before.values);
    if (was > 0) {
      const grew = (value / was - 1) * 100;
      stats.push({
        label: `On fiscal ${before.year.fiscalYear}`,
        value: pct(grew),
        tone: tone(part.lowerIsBetter === true ? grew < 0 : grew >= 0),
      });
    }
  }
  stats.push({
    label: `${series.length}-year average`,
    value: moneyShort(average),
    tone: "",
  });
  stats.push({ label: "Rank, highest first", value: rankText, tone: "" });
  const usual =
    value > average * 1.4 ? "Well above" : value < average * 0.6 ? "Well below" : "Close to";
  return {
    ...base,
    big: moneyShort(value),
    sub: `Fiscal ${fiscalYear}, ${share.toFixed(0)}% of the cash it had to use`,
    verdict: {
      before: `${usual} its usual ${moneyShort(average)}.`,
      ...(id === "savings" && value > 0
        ? {
            after: ` It paid out ${moneyShort(value)} more than its business brought in.`,
          }
        : {}),
    },
    stats,
  };
}

export const formatValue = (unit: "cents" | "dollars", value: number) =>
  unit === "cents" ? cents(value) : moneyShort(value);
