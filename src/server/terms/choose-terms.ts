import {
  partTags,
  partialTags,
  relatedTagPrefixes,
  type TermKey,
  termKeys,
  termNames,
  termTags,
} from "./term-tags";

import type { CheckedFigure, Figure, SetAside, Source } from "../../shared/figures";

export type { CheckedFigure, Figure, SetAside, Source };

export type NumberRow = {
  readonly tag: string;
  readonly fiscalYear: number;
  readonly value: number;
  readonly accession: string;
  readonly filedOn: string;
  readonly startOn?: string | null;
  readonly endOn?: string;
};

export type FiscalYearTerms = {
  readonly fiscalYear: number;
  readonly terms: Record<TermKey, CheckedFigure>;
};

export type UnlistedTag = {
  readonly term: TermKey;
  readonly tag: string;
  readonly fiscalYears: ReadonlyArray<number>;
};

export type TermTable = {
  readonly fiscalYears: ReadonlyArray<FiscalYearTerms>;
  readonly unlisted: ReadonlyArray<UnlistedTag>;
};

// Filings round to the nearest million, and a few lines added together can
// drift by a few of those. A tenth of a percent of revenue covers that.
export const roundingAllowanceShareOfRevenue = 0.001;

export const grossProfitCheck = "Gross profit should equal revenue minus cost of revenue.";
export const operatingIncomeCheck =
  "Operating income should equal what the company reports as its total operating expenses taken from gross profit, or its total costs and expenses taken from revenue.";

export const toSource = (row: NumberRow): Source => ({
  tag: row.tag,
  value: row.value,
  accession: row.accession,
  filedOn: row.filedOn,
});

export type Reported = Extract<Figure, { kind: "reported" }>;

export const reported = (
  byTagAndYear: Map<string, ReadonlyArray<NumberRow>>,
  tags: ReadonlyArray<string>,
  fiscalYear: number,
): Reported | null => {
  for (const tag of tags) {
    const rows = byTagAndYear.get(`${tag}/${fiscalYear}`);
    if (rows === undefined || rows.length === 0) continue;
    const byFiling = [...rows].sort((a, b) => a.filedOn.localeCompare(b.filedOn));
    const original = byFiling[0]!;
    const latest = byFiling[byFiling.length - 1]!;
    return {
      kind: "reported",
      value: latest.value,
      latest: toSource(latest),
      original: toSource(original),
    };
  }
  return null;
};

export const valueOf = (figure: Figure) => (figure.kind === "gap" ? null : figure.value);

export const gap: Figure = { kind: "gap" };

const termsForYear = (
  byTagAndYear: Map<string, ReadonlyArray<NumberRow>>,
  fiscalYear: number,
): Record<TermKey, CheckedFigure> => {
  const pick = (term: TermKey): Figure => reported(byTagAndYear, termTags[term], fiscalYear) ?? gap;

  const revenue = pick("revenue");
  const costOfRevenue = pick("costOfRevenue");
  const revenueValue = valueOf(revenue);
  const costValue = valueOf(costOfRevenue);
  const allowance =
    revenueValue === null ? 0 : Math.abs(revenueValue) * roundingAllowanceShareOfRevenue;
  const differs = (a: number, b: number) => Math.abs(a - b) > allowance;

  // Gross profit is defined as revenue minus cost of revenue, so a filed
  // figure that disagrees is set aside, still visible, and the definition
  // is used. That keeps every fiscal year comparable with the others.
  let grossProfit = pick("grossProfit");
  if (revenueValue !== null && costValue !== null) {
    const filed = grossProfit.kind === "reported" ? grossProfit : null;
    if (filed === null || differs(filed.value, revenueValue - costValue)) {
      grossProfit = {
        kind: "calculated",
        value: revenueValue - costValue,
        from: [
          { name: termNames.revenue, value: revenueValue },
          { name: termNames.costOfRevenue, value: -costValue },
        ],
        setAside: filed === null ? null : { ...filed.latest, doubtful: grossProfitCheck },
      };
    }
  }

  let sellingGeneralAndAdministrative = pick("sellingGeneralAndAdministrative");
  if (sellingGeneralAndAdministrative.kind === "gap") {
    const selling = reported(byTagAndYear, partTags.sellingAndMarketing, fiscalYear);
    const general = reported(byTagAndYear, partTags.generalAndAdministrative, fiscalYear);
    if (selling !== null && general !== null) {
      sellingGeneralAndAdministrative = {
        kind: "calculated",
        value: selling.value + general.value,
        from: [
          { name: "Selling and marketing", value: selling.value },
          { name: "General and administrative", value: general.value },
        ],
        setAside: null,
      };
    }
  }

  const researchAndDevelopment = pick("researchAndDevelopment");
  const operatingIncome = pick("operatingIncome");
  const grossProfitValue = valueOf(grossProfit);
  const operatingIncomeValue = valueOf(operatingIncome);

  // Operating income is the audited line. Whatever lies between it and the
  // named expenses, such as impairments and restructuring, is shown as
  // other operating expenses, so every year adds up to operating income.
  let otherOperatingExpenses: Figure = gap;
  if (grossProfitValue !== null && operatingIncomeValue !== null) {
    const research = valueOf(researchAndDevelopment) ?? 0;
    const selling = valueOf(sellingGeneralAndAdministrative) ?? 0;
    otherOperatingExpenses = {
      kind: "calculated",
      value: grossProfitValue - research - selling - operatingIncomeValue,
      from: [
        { name: termNames.grossProfit, value: grossProfitValue },
        { name: termNames.researchAndDevelopment, value: -research },
        { name: termNames.sellingGeneralAndAdministrative, value: -selling },
        { name: termNames.operatingIncome, value: -operatingIncomeValue },
      ],
      setAside: null,
    };
  }

  const totalOperatingExpenses = reported(
    byTagAndYear,
    partTags.operatingExpensesTotal,
    fiscalYear,
  );
  const totalCostsAndExpenses = reported(byTagAndYear, partTags.costsAndExpensesTotal, fiscalYear);
  const expectedOperatingIncome =
    totalOperatingExpenses !== null && grossProfitValue !== null
      ? grossProfitValue - totalOperatingExpenses.value
      : totalCostsAndExpenses !== null && revenueValue !== null
        ? revenueValue - totalCostsAndExpenses.value
        : null;
  const operatingIncomeDoubtful =
    expectedOperatingIncome !== null &&
    operatingIncomeValue !== null &&
    differs(operatingIncomeValue, expectedOperatingIncome)
      ? operatingIncomeCheck
      : null;

  const terms: Record<TermKey, Figure> = {
    revenue,
    costOfRevenue,
    grossProfit,
    researchAndDevelopment,
    sellingGeneralAndAdministrative,
    otherOperatingExpenses,
    operatingIncome,
    netIncome: pick("netIncome"),
  };
  return Object.fromEntries(
    termKeys.map((term) => [
      term,
      { ...terms[term], doubtful: term === "operatingIncome" ? operatingIncomeDoubtful : null },
    ]),
  ) as Record<TermKey, CheckedFigure>;
};

const findUnlisted = (rows: ReadonlyArray<NumberRow>): ReadonlyArray<UnlistedTag> => {
  const known = new Set([
    ...Object.values(termTags).flat(),
    ...Object.values(partTags).flat(),
    ...partialTags,
  ]);
  const yearsByTag = new Map<string, Set<number>>();
  for (const row of rows) {
    if (known.has(row.tag)) continue;
    const years = yearsByTag.get(row.tag) ?? new Set();
    years.add(row.fiscalYear);
    yearsByTag.set(row.tag, years);
  }
  const unlisted: Array<UnlistedTag> = [];
  for (const term of termKeys) {
    for (const [tag, years] of yearsByTag) {
      if (relatedTagPrefixes[term].some((prefix) => tag.startsWith(prefix))) {
        unlisted.push({
          term,
          tag,
          fiscalYears: [...years].sort((a, b) => a - b),
        });
      }
    }
  }
  return unlisted;
};

export const groupByTagAndYear = (rows: ReadonlyArray<NumberRow>) => {
  const byTagAndYear = new Map<string, Array<NumberRow>>();
  for (const row of rows) {
    const key = `${row.tag}/${row.fiscalYear}`;
    const list = byTagAndYear.get(key);
    if (list === undefined) byTagAndYear.set(key, [row]);
    else list.push(row);
  }
  return byTagAndYear;
};

export const chooseTerms = (rows: ReadonlyArray<NumberRow>): TermTable => {
  const byTagAndYear = groupByTagAndYear(rows);

  const revenueTags = new Set(termTags.revenue);
  const fiscalYears = [
    ...new Set(rows.filter((row) => revenueTags.has(row.tag)).map((row) => row.fiscalYear)),
  ].sort((a, b) => a - b);

  return {
    fiscalYears: fiscalYears.map((fiscalYear) => ({
      fiscalYear,
      terms: termsForYear(byTagAndYear, fiscalYear),
    })),
    unlisted: findUnlisted(rows),
  };
};
