import type { CheckedFigure, Figure } from "../../shared/figures";
import {
  chooseTerms,
  gap,
  groupByTagAndYear,
  type NumberRow,
  type Reported,
  reported,
  roundingAllowanceShareOfRevenue,
  toSource,
  valueOf,
} from "./choose-terms";
import {
  type BalanceKey,
  balanceTags,
  type CashFlowKey,
  cashFlowKeys,
  cashFlowTags,
  debtParts,
  earningsPerShareTags,
  liabilitiesAndEquityTags,
  longTermDebtTotalTags,
  type RatioKey,
} from "./statement-tags";
import { type TermKey, termKeys, termNames, termTags } from "./term-tags";

export type StatementKey = TermKey | BalanceKey | CashFlowKey | RatioKey | "earningsPerShare";

export type StatementYear = {
  readonly fiscalYear: number;
  readonly startOn: string;
  readonly endOn: string;
  readonly terms: Record<StatementKey, CheckedFigure>;
};

export const balanceCheck = "Assets should equal liabilities plus equity.";

const dayInMilliseconds = 24 * 60 * 60 * 1000;
const daysApart = (a: string, b: string) =>
  Math.abs(Date.parse(a) - Date.parse(b)) / dayInMilliseconds;

const byFiledOn = (a: NumberRow, b: NumberRow) => a.filedOn.localeCompare(b.filedOn);

const checked = (figure: Figure, doubtful: string | null = null): CheckedFigure => ({
  ...figure,
  doubtful,
});

const fromRows = (rows: ReadonlyArray<NumberRow>, prefer: string | null): Reported => {
  const sorted = [...rows].sort(byFiledOn);
  const latest = sorted.find((row) => row.accession === prefer) ?? sorted.at(-1)!;
  return {
    kind: "reported",
    value: latest.value,
    latest: toSource(latest),
    original: toSource(sorted[0]!),
  };
};

const sum = (
  parts: ReadonlyArray<{
    readonly name: string;
    readonly figure: Figure | null;
  }>,
): Figure => {
  const present = parts.flatMap(({ name, figure }) =>
    figure === null || figure.kind === "gap" ? [] : [{ name, value: figure.value }],
  );
  if (present.length === 0) return gap;
  return {
    kind: "calculated",
    value: present.reduce((total, part) => total + part.value, 0),
    from: present,
    setAside: null,
  };
};

const difference = (
  first: { readonly name: string; readonly figure: Figure },
  second: { readonly name: string; readonly figure: Figure },
): Figure => {
  const a = valueOf(first.figure);
  const b = valueOf(second.figure);
  if (a === null || b === null) return gap;
  return {
    kind: "calculated",
    value: a - b,
    from: [
      { name: first.name, value: a },
      { name: second.name, value: -b },
    ],
    setAside: null,
  };
};

const ratio = (
  part: { readonly name: string; readonly figure: Figure },
  whole: { readonly name: string; readonly figure: Figure },
): Figure => {
  const a = valueOf(part.figure);
  const b = valueOf(whole.figure);
  if (a === null || b === null || b === 0) return gap;
  return {
    kind: "calculated",
    value: a / b,
    from: [
      { name: part.name, value: a },
      { name: whole.name, value: b },
    ],
    setAside: null,
  };
};

// Old filings are not adjusted for later share splits. A split shows where a
// later filing gives the same fiscal year's earnings per share divided by a
// whole number: 4 for Apple in 2020, 7 in 2014.
type Split = { readonly ratio: number; readonly seenOn: string };

export const findSplits = (rows: ReadonlyArray<NumberRow>): ReadonlyArray<Split> => {
  const splits: Array<Split> = [];
  const byYear = new Map<number, Array<NumberRow>>();
  for (const row of rows) byYear.set(row.fiscalYear, [...(byYear.get(row.fiscalYear) ?? []), row]);
  for (const yearRows of byYear.values()) {
    const sorted = [...yearRows].sort(byFiledOn);
    for (let index = 1; index < sorted.length; index++) {
      const before = sorted[index - 1]!;
      const after = sorted[index]!;
      if (before.value <= 0 || after.value <= 0) continue;
      const times = before.value / after.value;
      const whole = Math.round(times);
      if (whole < 2 || Math.abs(times - whole) / whole > 0.015) continue;
      const same = splits.findIndex(
        (split) => split.ratio === whole && daysApart(split.seenOn, after.filedOn) < 400,
      );
      if (same === -1) splits.push({ ratio: whole, seenOn: after.filedOn });
      else if (after.filedOn < splits[same]!.seenOn) {
        splits[same] = { ratio: whole, seenOn: after.filedOn };
      }
    }
  }
  return splits.sort((a, b) => a.seenOn.localeCompare(b.seenOn));
};

const earningsPerShareFor = (
  byTagAndYear: Map<string, ReadonlyArray<NumberRow>>,
  splits: ReadonlyArray<Split>,
  fiscalYear: number,
): Figure => {
  const filed = reported(byTagAndYear, earningsPerShareTags, fiscalYear);
  if (filed === null) return gap;
  const later = splits.filter((split) => split.seenOn > filed.latest.filedOn);
  const divisor = later.reduce((total, split) => total * split.ratio, 1);
  if (divisor === 1) return filed;
  const names = later.map((split) => `${split.ratio}-for-1`).join(" and the ");
  return {
    kind: "calculated",
    value: filed.value / divisor,
    from: [{ name: "Earnings per share as filed", value: filed.value }],
    setAside: null,
    how: `Filed as $${filed.value.toFixed(2)} before the ${names} share split${later.length > 1 ? "s" : ""}, so divided by ${divisor} to compare with later fiscal years.`,
    latest: filed.latest,
  };
};

export const chooseStatements = (input: {
  readonly durations: ReadonlyArray<NumberRow>;
  readonly instants: ReadonlyArray<NumberRow>;
  readonly perShare: ReadonlyArray<NumberRow>;
}): ReadonlyArray<StatementYear> => {
  const income = chooseTerms(input.durations);
  const durations = groupByTagAndYear(input.durations);
  const perShare = groupByTagAndYear(input.perShare);
  const splits = findSplits(input.perShare.filter((row) => row.tag === earningsPerShareTags[0]));
  const revenueTags = new Set(termTags.revenue);

  const instantsByTag = new Map<string, Array<NumberRow>>();
  for (const row of input.instants) {
    instantsByTag.set(row.tag, [...(instantsByTag.get(row.tag) ?? []), row]);
  }

  return income.fiscalYears.map(({ fiscalYear, terms }) => {
    const revenueRows = input.durations
      .filter((row) => row.fiscalYear === fiscalYear && revenueTags.has(row.tag))
      .sort(byFiledOn);
    const period = revenueRows.at(-1);
    const startOn = period?.startOn ?? `${fiscalYear - 1}-01-01`;
    const endOn = period?.endOn ?? `${fiscalYear}-12-31`;

    // A balance is counted for a fiscal year only on its last day. The balance
    // sheet is taken whole from one filing where it can be, because a line
    // restated alone can break the sheet's own rule.
    const atYearEnd = (tag: string) =>
      (instantsByTag.get(tag) ?? []).filter(
        (row) => row.endOn !== undefined && daysApart(row.endOn, endOn) <= 7,
      );
    const wholeSheet = atYearEnd("Assets").sort(byFiledOn).at(-1)?.accession ?? null;
    const instant = (tags: ReadonlyArray<string>): Figure => {
      for (const tag of tags) {
        const rows = atYearEnd(tag);
        if (rows.length > 0) return fromRows(rows, wholeSheet);
      }
      return gap;
    };
    const flow = (tags: ReadonlyArray<string>): Figure =>
      reported(durations, tags, fiscalYear) ?? gap;

    const balance = Object.fromEntries(
      Object.entries(balanceTags).map(([key, tags]) => [key, instant(tags)]),
    ) as Record<keyof typeof balanceTags, Figure>;

    if (balance.liabilities.kind === "gap") {
      balance.liabilities = difference(
        {
          name: "Liabilities and equity",
          figure: instant(liabilitiesAndEquityTags),
        },
        { name: "Equity", figure: balance.equity },
      );
    }

    const parts = debtParts.map((part) => ({
      name: part.name,
      figure: instant(part.tags),
    }));
    const longer = parts.slice(1);
    const debt = longer.every((part) => part.figure.kind === "gap")
      ? sum([parts[0]!, { name: "Longer-term debt", figure: instant(longTermDebtTotalTags) }])
      : sum(parts);

    const assets = valueOf(balance.assets);
    const liabilities = valueOf(balance.liabilities);
    const equity = valueOf(balance.equity);
    const balanceDoubtful =
      assets !== null &&
      liabilities !== null &&
      equity !== null &&
      Math.abs(assets - liabilities - equity) > Math.abs(assets) * roundingAllowanceShareOfRevenue
        ? balanceCheck
        : null;

    const cashFlow = Object.fromEntries(
      Object.entries(cashFlowTags).map(([key, tags]) => [key, flow(tags)]),
    ) as Record<keyof typeof cashFlowTags, Figure>;

    const named = (key: TermKey) => ({
      name: termNames[key],
      figure: terms[key],
    });

    const all: Record<StatementKey, CheckedFigure> = {
      ...(Object.fromEntries(termKeys.map((key) => [key, terms[key]])) as Record<
        TermKey,
        CheckedFigure
      >),
      grossMargin: checked(ratio(named("grossProfit"), named("revenue"))),
      operatingMargin: checked(ratio(named("operatingIncome"), named("revenue"))),
      netMargin: checked(ratio(named("netIncome"), named("revenue"))),
      earningsPerShare: checked(earningsPerShareFor(perShare, splits, fiscalYear)),
      cash: checked(balance.cash),
      receivables: checked(balance.receivables),
      inventory: checked(balance.inventory),
      propertyPlantAndEquipment: checked(balance.propertyPlantAndEquipment),
      goodwill: checked(balance.goodwill),
      assets: checked(balance.assets, balanceDoubtful),
      debt: checked(debt),
      netDebt: checked(
        difference({ name: "Debt", figure: debt }, { name: "Cash", figure: balance.cash }),
      ),
      liabilities: checked(balance.liabilities),
      equity: checked(balance.equity),
      ...(Object.fromEntries(
        cashFlowKeys
          .filter((key) => key !== "freeCashFlow")
          .map((key) => [key, checked(cashFlow[key as keyof typeof cashFlowTags])]),
      ) as Record<Exclude<CashFlowKey, "freeCashFlow">, CheckedFigure>),
      freeCashFlow: checked(
        difference(
          { name: "Operating cash flow", figure: cashFlow.operatingCashFlow },
          { name: "Capital expenditure", figure: cashFlow.capitalExpenditure },
        ),
      ),
    };
    return { fiscalYear, startOn, endOn, terms: all };
  });
};
