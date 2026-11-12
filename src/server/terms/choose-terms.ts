import {
  partTags,
  partialTags,
  relatedTagPrefixes,
  type TermKey,
  termKeys,
  termNames,
  termTags,
} from "./term-tags";

export type NumberRow = {
  readonly tag: string;
  readonly fiscalYear: number;
  readonly value: number;
  readonly accession: string;
  readonly filedOn: string;
};

export type Source = Pick<NumberRow, "tag" | "value" | "accession" | "filedOn">;

export type Figure =
  | {
      readonly kind: "reported";
      readonly value: number;
      readonly latest: Source;
      readonly original: Source;
    }
  | {
      readonly kind: "calculated";
      readonly value: number;
      readonly from: ReadonlyArray<{
        readonly name: string;
        readonly value: number;
      }>;
    }
  | { readonly kind: "gap" };

export type CheckedFigure = Figure & { readonly doubtful: string | null };

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

const toSource = (row: NumberRow): Source => ({
  tag: row.tag,
  value: row.value,
  accession: row.accession,
  filedOn: row.filedOn,
});

const reported = (
  byTagAndYear: Map<string, ReadonlyArray<NumberRow>>,
  tags: ReadonlyArray<string>,
  fiscalYear: number,
): Figure | null => {
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

const valueOf = (figure: Figure) => (figure.kind === "gap" ? null : figure.value);

const chooseYear = (
  byTagAndYear: Map<string, ReadonlyArray<NumberRow>>,
  fiscalYear: number,
): Record<TermKey, Figure> => {
  const gap: Figure = { kind: "gap" };
  const pick = (term: TermKey) => reported(byTagAndYear, termTags[term], fiscalYear) ?? gap;

  const revenue = pick("revenue");
  const costOfRevenue = pick("costOfRevenue");
  const revenueValue = valueOf(revenue);
  const costValue = valueOf(costOfRevenue);

  let grossProfit = pick("grossProfit");
  if (grossProfit.kind === "gap" && revenueValue !== null && costValue !== null) {
    grossProfit = {
      kind: "calculated",
      value: revenueValue - costValue,
      from: [
        { name: termNames.revenue, value: revenueValue },
        { name: termNames.costOfRevenue, value: -costValue },
      ],
    };
  }

  let sellingGeneralAndAdministrative = pick("sellingGeneralAndAdministrative");
  if (sellingGeneralAndAdministrative.kind === "gap") {
    const selling = reported(byTagAndYear, partTags.sellingAndMarketing, fiscalYear);
    const general = reported(byTagAndYear, partTags.generalAndAdministrative, fiscalYear);
    if (selling?.kind === "reported" && general?.kind === "reported") {
      sellingGeneralAndAdministrative = {
        kind: "calculated",
        value: selling.value + general.value,
        from: [
          { name: "Selling and marketing", value: selling.value },
          { name: "General and administrative", value: general.value },
        ],
      };
    }
  }

  return {
    revenue,
    costOfRevenue,
    grossProfit,
    researchAndDevelopment: pick("researchAndDevelopment"),
    sellingGeneralAndAdministrative,
    operatingIncome: pick("operatingIncome"),
    netIncome: pick("netIncome"),
  };
};

const checkYear = (terms: Record<TermKey, Figure>): Record<TermKey, CheckedFigure> => {
  const doubtful = Object.fromEntries(termKeys.map((term) => [term, null])) as Record<
    TermKey,
    string | null
  >;
  const revenue = valueOf(terms.revenue);
  const allowance = revenue === null ? 0 : Math.abs(revenue) * roundingAllowanceShareOfRevenue;
  const differs = (a: number, b: number) => Math.abs(a - b) > allowance;

  const cost = valueOf(terms.costOfRevenue);
  const grossProfit = valueOf(terms.grossProfit);
  if (
    terms.grossProfit.kind === "reported" &&
    revenue !== null &&
    cost !== null &&
    grossProfit !== null &&
    differs(grossProfit, revenue - cost)
  ) {
    doubtful.grossProfit = "Gross profit should equal revenue minus cost of revenue.";
  }

  const operatingIncome = valueOf(terms.operatingIncome);
  if (operatingIncome !== null && grossProfit !== null && revenue !== null) {
    const expenses =
      (valueOf(terms.researchAndDevelopment) ?? 0) +
      (valueOf(terms.sellingGeneralAndAdministrative) ?? 0);
    if (differs(operatingIncome, grossProfit - expenses)) {
      doubtful.operatingIncome =
        "Operating income should equal gross profit minus research and development and selling, general and administrative.";
    }
  }

  return Object.fromEntries(
    termKeys.map((term) => [term, { ...terms[term], doubtful: doubtful[term] }]),
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

export const chooseTerms = (rows: ReadonlyArray<NumberRow>): TermTable => {
  const byTagAndYear = new Map<string, Array<NumberRow>>();
  for (const row of rows) {
    const key = `${row.tag}/${row.fiscalYear}`;
    byTagAndYear.set(key, [...(byTagAndYear.get(key) ?? []), row]);
  }

  const revenueTags = new Set(termTags.revenue);
  const fiscalYears = [
    ...new Set(rows.filter((row) => revenueTags.has(row.tag)).map((row) => row.fiscalYear)),
  ].sort((a, b) => a - b);

  return {
    fiscalYears: fiscalYears.map((fiscalYear) => ({
      fiscalYear,
      terms: checkYear(chooseYear(byTagAndYear, fiscalYear)),
    })),
    unlisted: findUnlisted(rows),
  };
};
