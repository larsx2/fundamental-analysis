import type { CheckedFigure, Figure } from "../../shared/figures";
import { money } from "../../shared/format";
import { dayInMilliseconds } from "../days";
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
  cashIncludingRestrictedCash,
  cashOfBusinessesBeingSold,
  debtParts,
  earningsPerShareTags,
  incomeTaxTags,
  liabilitiesAndEquityTags,
  longTermDebtTotalTags,
  type RatioKey,
  restrictedCashParts,
  restrictedCashTotal,
} from "./statement-tags";
import { type TermKey, termKeys, termNames, termTags } from "./term-tags";

export type StatementKey =
  | TermKey
  | BalanceKey
  | CashFlowKey
  | RatioKey
  | "earningsPerShare"
  | "incomeTax";

export type StatementYear = {
  readonly fiscalYear: number;
  readonly startOn: string;
  readonly endOn: string;
  readonly terms: Record<StatementKey, CheckedFigure>;
};

export const balanceCheck = "Assets should equal liabilities plus equity.";

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

type Part = { readonly name: string; readonly tags: ReadonlyArray<string> };
type Taken = { readonly name: string; readonly value: number };
type CashAndTotal = { readonly cash: number; readonly total: number };

const equalNeighbours = (
  yearEnds: ReadonlyArray<{ readonly fiscalYear: number; readonly endOn: string }>,
  fiscalYear: number,
  cashAndTotalOn: (endOn: string) => CashAndTotal | null,
) => {
  const bothFiled = yearEnds.flatMap((year) => {
    const both = cashAndTotalOn(year.endOn);
    return both === null ? [] : [{ fiscalYear: year.fiscalYear, ...both }];
  });
  const before = bothFiled.filter((each) => each.fiscalYear < fiscalYear).at(-1);
  const after = bothFiled.find((each) => each.fiscalYear > fiscalYear);
  if (before === undefined || after === undefined) return null;
  return before.cash === before.total && after.cash === after.total ? { before, after } : null;
};

const howCashWasFound = (input: {
  readonly fiscalYear: number;
  readonly total: number;
  readonly taken: ReadonlyArray<Taken>;
  readonly forSale: Taken | null;
  readonly unrestricted: ReturnType<typeof equalNeighbours>;
}) => {
  const { fiscalYear, forSale, unrestricted } = input;
  if (unrestricted !== null) {
    const lessForSale =
      forSale !== null && forSale.value !== 0
        ? `, less ${money(forSale.value)} of cash of businesses being sold`
        : "";
    return `No figure for restricted cash was filed for the end of fiscal ${fiscalYear}. Cash including restricted cash equalled cash at the end of fiscal ${unrestricted.before.fiscalYear} (${money(unrestricted.before.cash)}) and ${unrestricted.after.fiscalYear} (${money(unrestricted.after.cash)}), the nearest years where both were filed, so the ${money(input.total)} total is shown as cash${lessForSale}.`;
  }
  if (input.taken.every((part) => part.value === 0)) {
    return `${forSale === null ? "Restricted cash was" : "Restricted cash and the cash of businesses being sold were"} filed as $0 for the end of fiscal ${fiscalYear}, so the total is shown as cash.`;
  }
  return undefined;
};

const cashFiledWithRestrictedCash = (
  fiscalYear: number,
  total: Figure,
  atYearEnd: (tag: string) => ReadonlyArray<NumberRow>,
  neighbours: (totalTag: string) => ReturnType<typeof equalNeighbours>,
): Figure => {
  if (total.kind !== "reported") return gap;
  const reportedFor = (part: Part): Taken | null => {
    for (const tag of part.tags) {
      const rows = atYearEnd(tag);
      const row =
        rows.find((each) => each.accession === total.latest.accession) ??
        [...rows].sort(byFiledOn).at(-1);
      if (row !== undefined) return { name: part.name, value: row.value };
    }
    return null;
  };
  const whole = reportedFor(restrictedCashTotal);
  const parts = restrictedCashParts.flatMap((part) => reportedFor(part) ?? []);
  const includesForSale = total.latest.tag === cashOfBusinessesBeingSold.includedIn;
  const forSale = includesForSale ? reportedFor(cashOfBusinessesBeingSold) : null;
  if (includesForSale && forSale === null) return gap;
  if ([whole, ...parts, forSale].some((part) => part !== null && part.value < 0)) return gap;
  const restricted =
    whole !== null && whole.value >= parts.reduce((added, part) => added + part.value, 0)
      ? [whole]
      : parts;
  const taken = [...restricted, ...(forSale === null ? [] : [forSale])];
  const unrestricted = restricted.length === 0 ? neighbours(total.latest.tag) : null;
  if (restricted.length === 0 && unrestricted === null) return gap;
  const value = taken.reduce((cash, part) => cash - part.value, total.value);
  if (value < 0) return gap;
  const how = howCashWasFound({ fiscalYear, total: total.value, taken, forSale, unrestricted });
  return {
    kind: "calculated",
    value,
    from: [
      { name: cashIncludingRestrictedCash.name, value: total.value },
      ...taken.map((part) => ({ name: part.name, value: part.value === 0 ? 0 : -part.value })),
    ],
    setAside: null,
    latest: total.latest,
    ...(how === undefined ? {} : { how }),
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

  const yearEnds = income.fiscalYears.map(({ fiscalYear }) => {
    const period = input.durations
      .filter((row) => row.fiscalYear === fiscalYear && revenueTags.has(row.tag))
      .sort(byFiledOn)
      .at(-1);
    return {
      fiscalYear,
      startOn: period?.startOn ?? `${fiscalYear - 1}-01-01`,
      endOn: period?.endOn ?? `${fiscalYear}-12-31`,
    };
  });
  const onDay = (tag: string, day: string) =>
    (instantsByTag.get(tag) ?? []).filter(
      (row) => row.endOn !== undefined && daysApart(row.endOn, day) <= 7,
    );
  const latestOn = (tags: ReadonlyArray<string>, day: string) => {
    for (const tag of tags) {
      const row = onDay(tag, day).sort(byFiledOn).at(-1);
      if (row !== undefined) return row.value;
    }
    return null;
  };
  const cashAndTotalOn = (totalTag: string) => (day: string) => {
    const cash = latestOn(balanceTags.cash, day);
    const total = latestOn([totalTag], day);
    return cash === null || total === null ? null : { cash, total };
  };

  return income.fiscalYears.map(({ fiscalYear, terms }, index) => {
    const { startOn, endOn } = yearEnds[index]!;

    // A balance is counted for a fiscal year only on its last day. The balance
    // sheet is taken whole from one filing where it can be, because a line
    // restated alone can break the sheet's own rule.
    const atYearEnd = (tag: string) => onDay(tag, endOn);
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

    const cash =
      balance.cash.kind === "gap"
        ? cashFiledWithRestrictedCash(
            fiscalYear,
            instant(cashIncludingRestrictedCash.tags),
            atYearEnd,
            (totalTag) => equalNeighbours(yearEnds, fiscalYear, cashAndTotalOn(totalTag)),
          )
        : balance.cash;

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
      incomeTax: checked(flow(incomeTaxTags)),
      cash: checked(cash),
      receivables: checked(balance.receivables),
      inventory: checked(balance.inventory),
      propertyPlantAndEquipment: checked(balance.propertyPlantAndEquipment),
      goodwill: checked(balance.goodwill),
      assets: checked(balance.assets, balanceDoubtful),
      debt: checked(debt),
      netDebt: checked(difference({ name: "Debt", figure: debt }, { name: "Cash", figure: cash })),
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
