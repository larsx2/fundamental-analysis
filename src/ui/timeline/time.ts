import type { StatementYear } from "../../functions/company";
import { rate } from "../../shared/format";

export type EconomyMonth = {
  readonly month: string;
  readonly interestRate: number | null;
  readonly inflation: number | null;
  readonly recession: boolean;
};

export type Span = StatementYear & { readonly start: Date; readonly end: Date };

export const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
export const middle = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 15));
export const monthStart = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
export const nextMonth = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
export const inflationText = (value: number | null) => (value === null ? "gap" : rate(value, 1));

export const spansOf = (years: ReadonlyArray<StatementYear>): ReadonlyArray<Span> =>
  years.map((each) => ({
    ...each,
    start: day(each.startOn),
    end: day(each.endOn),
  }));

export const fiscalOf = (spans: ReadonlyArray<Span>, date: Date) =>
  spans.find((span) => date >= span.start && date <= span.end) ??
  spans.find((span) => date >= span.start && date.getTime() <= span.end.getTime() + 864e5);

export const recessionRuns = (months: ReadonlyArray<EconomyMonth>) => {
  const runs: Array<Array<string>> = [];
  months.forEach((each, index) => {
    if (!each.recession) return;
    const last = runs.at(-1);
    if (last !== undefined && last.at(-1) === months[index - 1]?.month) last.push(each.month);
    else runs.push([each.month]);
  });
  return runs;
};

export const nearestMonth = (months: ReadonlyArray<EconomyMonth>, date: Date) => {
  let best = months[0];
  for (const each of months)
    if (
      best === undefined ||
      Math.abs(+middle(each.month) - +date) < Math.abs(+middle(best.month) - +date)
    )
      best = each;
  return best?.month ?? null;
};

// Where years are too narrow for every label, every other one is named,
// and always the chosen one.
export const yearLabelShown =
  (thin: boolean, chosenIndex: number, lastIndex: number) => (index: number) =>
    !thin ||
    index === chosenIndex ||
    (Math.abs(index - chosenIndex) > 1 && index % 2 === lastIndex % 2);

const steps: Record<string, number> = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1,
  PageUp: 12,
  PageDown: -12,
};

export const monthAfterKey = (
  key: string,
  monthIndex: number,
  months: ReadonlyArray<EconomyMonth>,
) => {
  let next: number | null = null;
  if (key in steps) next = monthIndex + steps[key]!;
  if (key === "Home") next = 0;
  if (key === "End") next = months.length - 1;
  if (next === null || months.length === 0) return null;
  return months[Math.max(0, Math.min(months.length - 1, next))]?.month ?? null;
};
