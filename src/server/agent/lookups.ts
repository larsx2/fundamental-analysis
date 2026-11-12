import { Data } from "effect";
import { findTerm, type GlossaryTerm } from "../../glossary/glossary";
import { compoundAnnualGrowthRate, yearsShown } from "../../shared/company-summary";
import { type CheckedFigure, valueOf } from "../../shared/figures";
import type { Drawing, FilingLink, LookupResult, Series, Shade, Unit } from "../../shared/lookups";
import {
  centsOfDollar,
  filingUrl,
  longDate,
  lowerFirst,
  money,
  monthName,
  percent,
  perShare,
  signedPercent,
  signedPoints,
  yearEndInWords,
  yearOverYear,
} from "../../ui/format";
import { isDoubtful } from "../../ui/marks";
import { yearParts } from "../../ui/money-flow/parts";
import { type FigureKey, figureOf, keyOfTerm, ratioKeys } from "../../ui/own-figure";
import type { EconomyMonth } from "../economy";
import type { CorporateEvent } from "../filings";
import type { StatementYear } from "../terms/statements";

export type CompanyData = {
  readonly cik: number;
  readonly name: string;
  readonly ticker: string;
  readonly years: ReadonlyArray<StatementYear>;
  readonly events: ReadonlyArray<CorporateEvent>;
  readonly description: {
    readonly text: string;
    readonly accession: string;
    readonly document: string | null;
    readonly filedOn: string;
  } | null;
  readonly months: ReadonlyArray<EconomyMonth>;
};

export class LookupProblem extends Data.TaggedError("LookupProblem")<{
  readonly message: string;
}> {}

const annualReport = "Annual report (10-K)";
const currentReport = "Current report (8-K)";

const notCollected = [
  "segments, so the tool cannot split revenue by product or place",
  "the number of shares, so it cannot show dilution",
  "share prices, so it cannot say whether the shares are cheap or worth buying",
  "the text of the annual report beyond the opening of the business description, so it cannot quote risks, competitors or what the company says about its year",
  "short-term investments, so cash may read low and net debt high",
  "interest and tax on their own lines, so return on invested capital can only be worked out before tax",
];

const recent = (company: CompanyData) => company.years.slice(-yearsShown);
const first = <T>(list: ReadonlyArray<T>) => list[0]!;
const last = <T>(list: ReadonlyArray<T>) => list.at(-1)!;
const span = (list: ReadonlyArray<StatementYear>) =>
  `fiscal ${first(list).fiscalYear} to ${last(list).fiscalYear}`;

const sourceOf = (figure: CheckedFigure | undefined) =>
  figure === undefined
    ? null
    : figure.kind === "reported"
      ? figure.latest
      : figure.kind === "calculated"
        ? (figure.latest ?? null)
        : null;

const filingsOf = (cik: number, figures: ReadonlyArray<CheckedFigure | undefined>) => {
  const seen = new Map<string, string>();
  for (const figure of figures) {
    const source = sourceOf(figure);
    if (source !== null) seen.set(source.accession, source.filedOn);
  }
  return [...seen]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 3)
    .map(([accession, filedOn]): FilingLink => ({
      form: annualReport,
      filedOn,
      url: filingUrl(cik, accession),
    }));
};

const pickYear = (company: CompanyData, asked: number | undefined) => {
  if (asked === undefined) return last(company.years);
  const year = company.years.find((each) => each.fiscalYear === asked);
  if (year === undefined) {
    throw new LookupProblem({
      message: `${company.name} has no fiscal ${asked} collected. Collected: ${span(company.years)}.`,
    });
  }
  return year;
};

const unitOf = (key: FigureKey, asShare: boolean): Unit =>
  asShare || ratioKeys.has(key) ? "share" : key === "earningsPerShare" ? "perShare" : "money";

const writeValue = (unit: Unit, value: number) =>
  unit === "share"
    ? percent(value)
    : unit === "perShare"
      ? perShare(value)
      : unit === "cents"
        ? `${value}¢`
        : unit === "change"
          ? signedPercent(value)
          : money(value);

const perDollar = (ratio: number) =>
  ratio >= 1 ? `$${ratio.toFixed(2)}` : `${Math.round(ratio * 100)}¢`;

const monthsOf = (company: CompanyData, year: StatementYear) =>
  company.months.filter(
    (month) => month.month >= year.startOn.slice(0, 7) && month.month <= year.endOn.slice(0, 7),
  );

const recessionYears = (company: CompanyData) =>
  company.years
    .filter((year) => monthsOf(company, year).some((month) => month.recession))
    .map((year) => year.fiscalYear);

const risingRateYears = (company: CompanyData) =>
  company.years
    .filter((year) => {
      const rates = monthsOf(company, year).flatMap((month) =>
        month.interestRate === null ? [] : [month.interestRate],
      );
      return rates.length > 1 && last(rates) - first(rates) >= 1;
    })
    .map((year) => year.fiscalYear);

const shadesFor = (company: CompanyData): ReadonlyArray<Shade> => [
  ...recessionYears(company).map((fiscalYear) => ({
    fiscalYear,
    why: "recession" as const,
  })),
  ...risingRateYears(company).map((fiscalYear) => ({
    fiscalYear,
    why: "rates" as const,
  })),
];

const company = (data: CompanyData): LookupResult => {
  const latest = last(data.years);
  const revenue = valueOf(latest.terms.revenue);
  const description = data.description;
  const opening =
    description === null
      ? null
      : description.text.length > 700
        ? `${description.text.slice(0, 700).replace(/\s+\S*$/, "")}…`
        : description.text;
  return {
    lookup: "company",
    title: data.name,
    detail: `Ticker ${data.ticker}, ${span(data.years)} collected`,
    figures: {
      "Fiscal years collected": span(data.years),
      "Fiscal year ends": yearEndInWords(data.years.map((year) => year.endOn)),
      [`Revenue, fiscal ${latest.fiscalYear}`]: revenue === null ? "gap" : money(revenue),
    },
    notes: [
      ...(opening === null
        ? ["The business description is not collected for this company."]
        : [`Opening of its business description, in its own words: ${opening}`]),
      ...notCollected.map((each) => `The tool does not collect ${each}.`),
      "The tool makes no forecasts and gives no advice on buying or selling.",
    ],
    drawing:
      description === null || opening === null
        ? null
        : {
            kind: "quote",
            title: "In its own words",
            text: opening,
            source: `The opening of the business description in its annual report (10-K), filed on ${longDate(description.filedOn)}.`,
            url: filingUrl(data.cik, description.accession, description.document),
          },
    filings:
      description === null
        ? filingsOf(data.cik, [latest.terms.revenue])
        : [
            {
              form: annualReport,
              filedOn: description.filedOn,
              url: filingUrl(data.cik, description.accession, description.document),
            },
          ],
  };
};

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

const trend = (
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

const dollar = (data: CompanyData, input: { readonly fiscalYear: number | undefined }) => {
  const year = pickYear(data, input.fiscalYear);
  const revenue = valueOf(year.terms.revenue);
  if (revenue === null || revenue <= 0) {
    throw new LookupProblem({
      message: `${data.name}'s revenue for fiscal ${year.fiscalYear} is a gap.`,
    });
  }
  const parts = yearParts(year);
  const cents = centsOfDollar(
    parts.map((part) => part.value),
    revenue,
  );
  const figures: Record<string, string> = {
    [`Revenue, fiscal ${year.fiscalYear}`]: money(revenue),
  };
  const notes: Array<string> = [];
  const drawn: Array<{ key: string; name: string; cents: number }> = [];
  parts.forEach((part, index) => {
    const share = cents[index] ?? 0;
    if (part.value === null) {
      if (part.key !== "below") notes.push(`${part.name} is a gap: not reported as its own line.`);
      return;
    }
    figures[`${part.name}, fiscal ${year.fiscalYear}`] = money(part.value);
    if (part.value > 0) {
      figures[`${part.name}, cents of each dollar of revenue`] = `${share}¢`;
      if (share > 0) drawn.push({ key: part.key, name: part.name, cents: share });
    }
  });
  const net = parts.find((part) => part.key === "netIncome")!;
  if (net.value !== null && net.value < 0) {
    notes.push(`Net income was a loss in fiscal ${year.fiscalYear}.`);
  }
  const largest = [...drawn]
    .filter((part) => part.key !== "netIncome")
    .sort((a, b) => b.cents - a.cents)[0];
  if (largest !== undefined) figures["Largest part of each dollar"] = largest.name;
  notes.push("Net income is what is left of each dollar, not what the company keeps.");
  return {
    lookup: "dollar",
    title: `Income statement, fiscal ${year.fiscalYear}`,
    detail: "Each part as cents of each dollar of revenue, worked out by the tool",
    figures,
    notes,
    drawing: {
      kind: "dollar",
      title: `Each dollar of revenue in fiscal ${year.fiscalYear}`,
      fiscalYear: year.fiscalYear,
      parts: drawn,
    },
    filings: filingsOf(data.cik, [year.terms.revenue, year.terms.netIncome]),
  } satisfies LookupResult;
};

const cash = (data: CompanyData): LookupResult => {
  const list = recent(data);
  const net = (year: StatementYear) => valueOf(year.terms.netIncome);
  const free = (year: StatementYear) => valueOf(year.terms.freeCashFlow);
  const figures: Record<string, string> = {};
  for (const year of list) {
    const n = net(year);
    const f = free(year);
    figures[`Net income, fiscal ${year.fiscalYear}`] = n === null ? "gap" : money(n);
    figures[`Free cash flow, fiscal ${year.fiscalYear}`] = f === null ? "gap" : money(f);
  }
  const latest = last(list);
  const flow = valueOf(latest.terms.operatingCashFlow);
  const spend = valueOf(latest.terms.capitalExpenditure);
  if (flow !== null) figures[`Operating cash flow, fiscal ${latest.fiscalYear}`] = money(flow);
  if (spend !== null) figures[`Capital expenditure, fiscal ${latest.fiscalYear}`] = money(spend);
  const both = list.filter((year) => net(year) !== null && free(year) !== null);
  const netTotal = both.reduce((total, year) => total + net(year)!, 0);
  const freeTotal = both.reduce((total, year) => total + free(year)!, 0);
  if (both.length > 1 && netTotal > 0) {
    figures[
      `Free cash flow for each dollar of net income, fiscal ${first(both).fiscalYear} to ${last(both).fiscalYear}`
    ] = perDollar(freeTotal / netTotal);
    figures["Fiscal years counted"] = String(both.length);
  }
  return {
    lookup: "cash",
    title: `Net income and free cash flow, ${span(list)}`,
    detail:
      "Free cash flow worked out by the tool from operating cash flow and capital expenditure",
    figures,
    notes: [
      "Free cash flow is operating cash flow minus capital expenditure.",
      "Net income can differ from cash, because some costs and income are counted before or after the cash moves.",
    ],
    drawing: {
      kind: "bars",
      title: `Net income and free cash flow, ${span(list)}`,
      unit: "money",
      rows: false,
      series: [
        {
          name: "Net income",
          term: "Net income",
          tone: "kept",
          points: list.map((year) => ({
            fiscalYear: year.fiscalYear,
            value: net(year),
          })),
        },
        {
          name: "Free cash flow",
          term: "Free cash flow",
          tone: "soft",
          points: list.map((year) => ({
            fiscalYear: year.fiscalYear,
            value: free(year),
          })),
        },
      ],
    },
    filings: filingsOf(data.cik, [
      latest.terms.netIncome,
      latest.terms.operatingCashFlow,
      latest.terms.capitalExpenditure,
    ]),
  };
};

const balance = (data: CompanyData, input: { readonly fiscalYear: number | undefined }) => {
  const year = pickYear(data, input.fiscalYear);
  const t = year.terms;
  const assets = valueOf(t.assets);
  const liabilities = valueOf(t.liabilities);
  const equity = valueOf(t.equity);
  const debt = valueOf(t.debt);
  const cashHeld = valueOf(t.cash);
  const netDebt = valueOf(t.netDebt);
  const flow = valueOf(t.operatingCashFlow);
  const on = `end of fiscal ${year.fiscalYear}`;
  const write = (value: number | null) => (value === null ? "gap" : money(value));
  const figures: Record<string, string> = {
    [`Assets, ${on}`]: write(assets),
    [`Liabilities, ${on}`]: write(liabilities),
    [`Equity, ${on}`]: write(equity),
    [`Debt, ${on}`]: write(debt),
    [`Cash, ${on}`]: write(cashHeld),
    [`Net debt, ${on}`]: write(netDebt),
    [`Operating cash flow, fiscal ${year.fiscalYear}`]: write(flow),
  };
  const notes = [
    "Cash leaves out short-term investments, which the tool does not collect, so cash may read low and net debt high.",
  ];
  if (debt !== null && flow !== null && debt > 0 && flow > 0) {
    figures["One year of operating cash flow covers its debt"] =
      `${(flow / debt).toFixed(1)} times`;
    figures["Its debt equals this many years of operating cash flow"] = (debt / flow).toFixed(1);
    if (debt < flow) notes.push("Its debt is less than one year of its operating cash flow.");
  }
  if (netDebt !== null && netDebt < 0) notes.push("It held more cash than debt.");
  return {
    lookup: "balance",
    title: `Balance sheet, ${on}`,
    detail: "Reported numbers; debt and net debt worked out by the tool",
    figures,
    notes,
    drawing:
      assets === null || liabilities === null
        ? null
        : {
            kind: "balance",
            title: `Balance sheet, ${on}`,
            assets,
            liabilities,
            equity,
          },
    filings: filingsOf(data.cik, [t.assets, t.liabilities, t.cash, t.operatingCashFlow]),
  } satisfies LookupResult;
};

const uses = [
  {
    key: "capitalExpenditure",
    name: "Capital expenditure",
    term: "Capital expenditure",
  },
  { key: "dividends", name: "Dividends", term: "Dividend" },
  { key: "shareBuybacks", name: "Share buybacks", term: "Share buyback" },
  { key: "acquisitions", name: "Acquisitions", term: "Acquisition" },
  { key: "debtRepaid", name: "Debt repaid", term: "Debt" },
] as const;

const usesOfCash = (data: CompanyData): LookupResult => {
  const list = recent(data);
  const figures: Record<string, string> = {};
  const notes: Array<string> = [];
  const totals = uses.map((use) => {
    const values = list.map((year) => valueOf(year.terms[use.key]));
    values.forEach((value, index) => {
      figures[`${use.name}, fiscal ${list[index]!.fiscalYear}`] =
        value === null ? "gap" : money(value);
    });
    const known = values.filter((value): value is number => value !== null);
    const total = known.reduce((sum, value) => sum + value, 0);
    if (known.length === 0) {
      notes.push(`${use.name} has no separate line in these years: a gap, not zero.`);
    } else {
      figures[`${use.name}, total ${span(list)}`] = money(total);
    }
    return { use, total, known: known.length };
  });
  const largest = [...totals].filter((each) => each.known > 0).sort((a, b) => b.total - a.total)[0];
  if (largest !== undefined) figures[`Largest use of cash, ${span(list)}`] = largest.use.name;
  const compensation = list.map((year) => valueOf(year.terms.stockBasedCompensation));
  const paidInShares = compensation.filter((value): value is number => value !== null);
  if (paidInShares.length > 0) {
    figures[`Stock-based compensation, total ${span(list)}`] = money(
      paidInShares.reduce((sum, value) => sum + value, 0),
    );
    compensation.forEach((value, index) => {
      figures[`Stock-based compensation, fiscal ${list[index]!.fiscalYear}`] =
        value === null ? "gap" : money(value);
    });
  }
  notes.push(
    "Dividends are the total paid, not the amount for each share.",
    "The tool does not collect the number of shares, so it cannot say whether the count of shares went down.",
  );
  return {
    lookup: "uses_of_cash",
    title: `Uses of cash, ${span(list)}`,
    detail: `${list.length * uses.length} figures from the cash flow statement`,
    figures,
    notes,
    drawing: {
      kind: "bars",
      title: `What it did with its cash, ${span(list)}`,
      unit: "money",
      rows: true,
      series: uses.map((use) => ({
        name: use.name,
        term: use.term,
        tone: "grey" as const,
        points: list.map((year) => ({
          fiscalYear: year.fiscalYear,
          value: valueOf(year.terms[use.key]),
        })),
      })),
    },
    filings: filingsOf(
      data.cik,
      uses.map((use) => last(list).terms[use.key]),
    ),
  };
};

const returns = (data: CompanyData): LookupResult => {
  const list = recent(data);
  const rough = (year: StatementYear) => {
    const income = valueOf(year.terms.operatingIncome);
    const debt = valueOf(year.terms.debt);
    const equity = valueOf(year.terms.equity);
    if (income === null || debt === null || equity === null || debt + equity <= 0) return null;
    return income / (debt + equity);
  };
  const figures: Record<string, string> = {};
  for (const year of list) {
    const value = rough(year);
    figures[`Operating income for each dollar of debt and equity, fiscal ${year.fiscalYear}`] =
      value === null ? "gap" : percent(value);
  }
  const latest = last(list);
  const write = (figure: CheckedFigure) => {
    const value = valueOf(figure);
    return value === null ? "gap" : money(value);
  };
  figures[`Operating income, fiscal ${latest.fiscalYear}`] = write(latest.terms.operatingIncome);
  figures[`Debt, end of fiscal ${latest.fiscalYear}`] = write(latest.terms.debt);
  figures[`Equity, end of fiscal ${latest.fiscalYear}`] = write(latest.terms.equity);
  return {
    lookup: "returns",
    title: `Operating income, debt and equity, ${span(list)}`,
    detail: "Divided by the tool, before tax",
    figures,
    notes: [
      "This is operating income divided by debt plus equity, before tax. Return on invested capital takes tax out first; the tool does not collect tax on its own line, so this rough version reads higher than the real one.",
    ],
    drawing: {
      kind: "bars",
      title: `Operating income for each dollar of debt and equity, before tax`,
      unit: "share",
      rows: false,
      series: [
        {
          name: "Before tax",
          term: "Return on invested capital",
          tone: "grey",
          points: list.map((year) => ({
            fiscalYear: year.fiscalYear,
            value: rough(year),
          })),
        },
      ],
    },
    filings: filingsOf(data.cik, [latest.terms.operatingIncome, latest.terms.equity]),
  };
};

const eventTitle = (event: CorporateEvent) =>
  event.kind === "business"
    ? "Acquisition or sale of a business completed"
    : "Change among directors or officers";

const context = (data: CompanyData): LookupResult => {
  const list = data.years.slice(-5);
  const from = first(list).startOn.slice(0, 7);
  const to = last(list).endOn.slice(0, 7);
  const months = data.months.filter((month) => month.month >= from && month.month <= to);
  const events = data.events.filter((event) => {
    const date = event.reportDate ?? event.filedOn;
    return date >= first(list).startOn && date <= last(list).endOn;
  });
  const figures: Record<string, string> = {};
  const rates = months.filter((month) => month.interestRate !== null);
  const prices = months.filter((month) => month.inflation !== null);
  if (rates.length > 0) {
    figures[`Interest rate, ${monthName(first(rates).month)}`] =
      `${first(rates).interestRate!.toFixed(2)}%`;
    figures[`Interest rate, ${monthName(last(rates).month)}`] =
      `${last(rates).interestRate!.toFixed(2)}%`;
  }
  if (prices.length > 0) {
    figures[`Inflation, ${monthName(first(prices).month)}`] =
      `${first(prices).inflation!.toFixed(1)}%`;
    figures[`Inflation, ${monthName(last(prices).month)}`] =
      `${last(prices).inflation!.toFixed(1)}%`;
  }
  const recessionMonths = months.filter((month) => month.recession);
  figures[`Months of recession, ${span(list)}`] = String(recessionMonths.length);
  const all = data.months;
  const end = all.findLastIndex((month) => month.recession);
  if (end !== -1) {
    let start = end;
    while (start > 0 && all[start - 1]!.recession) start -= 1;
    figures["Last recession"] = `${monthName(all[start]!.month)} to ${monthName(all[end]!.month)}`;
  }
  const recession = recessionYears(data);
  const rising = risingRateYears(data);
  figures["Fiscal years a recession touched"] =
    recession.length === 0 ? "none" : recession.join(", ");
  figures["Fiscal years the interest rate rose by more than a point"] =
    rising.length === 0 ? "none" : rising.join(", ");
  for (const fiscalYear of [...new Set([...recession, ...rising])]) {
    const year = data.years.find((each) => each.fiscalYear === fiscalYear);
    const before = data.years.find((each) => each.fiscalYear === fiscalYear - 1);
    if (year === undefined || before === undefined) continue;
    for (const [key, name] of [
      ["revenue", "Revenue"],
      ["netIncome", "Net income"],
    ] as const) {
      const change = yearOverYear(valueOf(year.terms[key]), valueOf(before.terms[key]));
      if (change !== null)
        figures[`${name}, change in fiscal ${fiscalYear}`] = signedPercent(change);
    }
  }
  figures[`Corporate events reported, ${span(list)}`] = String(events.length);
  const latestEvent = events.at(-1);
  if (latestEvent !== undefined) {
    figures["Latest corporate event"] =
      `${eventTitle(latestEvent)}, ${longDate(latestEvent.reportDate ?? latestEvent.filedOn)}`;
  }
  return {
    lookup: "context",
    title: `Interest rate, inflation and corporate events, ${span(list)}`,
    detail: `${months.length} months from the US central bank's public data, and ${events.length} current reports (8-K)`,
    figures,
    notes: [
      "Corporate events here are the two kinds the SEC's item numbers name: a director or officer arriving or leaving, and a completed acquisition or sale of a business.",
      "One company's years show what happened at the same time, not what caused what.",
    ],
    drawing: {
      kind: "economy",
      title: `Around ${data.name}, ${span(list)}`,
      months,
      events: events.map((event) => ({
        date: event.reportDate ?? event.filedOn,
        title: eventTitle(event),
        url: filingUrl(data.cik, event.accession, event.document),
      })),
    },
    filings: events
      .slice(-3)
      .reverse()
      .map((event) => ({
        form: currentReport,
        filedOn: event.filedOn,
        url: filingUrl(data.cik, event.accession, event.document),
      })),
  };
};

const markRows: ReadonlyArray<readonly [FigureKey, string]> = [
  ["revenue", "Revenue"],
  ["costOfRevenue", "Cost of revenue"],
  ["grossProfit", "Gross profit"],
  ["researchAndDevelopment", "Research and development"],
  ["sellingGeneralAndAdministrative", "Selling, general and administrative"],
  ["operatingIncome", "Operating income"],
  ["netIncome", "Net income"],
  ["operatingCashFlow", "Operating cash flow"],
  ["capitalExpenditure", "Capital expenditure"],
  ["freeCashFlow", "Free cash flow"],
  ["cash", "Cash"],
  ["debt", "Debt"],
];

const markOf = (figure: CheckedFigure) =>
  figure.kind === "gap"
    ? ("gap" as const)
    : isDoubtful(figure)
      ? ("doubtful" as const)
      : figure.kind === "calculated"
        ? ("calculated" as const)
        : ("reported" as const);

const marks = (data: CompanyData, input: { readonly fiscalYear: number | undefined }) => {
  const year = pickYear(data, input.fiscalYear);
  const all = data.years.flatMap((each) => Object.values(each.terms));
  const count = (mark: ReturnType<typeof markOf>) =>
    all.filter((figure) => markOf(figure) === mark).length;
  const restated = all.filter(
    (figure) => figure.kind === "reported" && figure.latest.accession !== figure.original.accession,
  ).length;
  return {
    lookup: "marks",
    title: "Marks on every figure",
    detail: `${all.length} figures, ${span(data.years)}`,
    figures: {
      "Figures held": String(all.length),
      "Reported numbers": String(count("reported")),
      "Calculated numbers": String(count("calculated")),
      Gaps: String(count("gap")),
      "Doubtful numbers": String(count("doubtful")),
      "Reported numbers taken from a later annual report than the first": String(restated),
    },
    notes: [
      "A reported number comes straight from an annual report (10-K). When a later report gives the same fiscal year again, the latest one is shown.",
      "A calculated number is worked out by the tool from reported numbers, and says how.",
      "A gap is a figure the company does not report as its own line. It is never shown as zero.",
      "A doubtful number failed one of the tool's checks, and is shown with the check it failed.",
    ],
    drawing: {
      kind: "marks",
      title: `Fiscal ${year.fiscalYear}, figure by figure`,
      rows: markRows.map(([key, name]) => {
        const figure = figureOf(year, key);
        const value = valueOf(figure);
        return {
          name,
          value: value === null ? "" : money(value),
          mark: markOf(figure),
          filedOn: sourceOf(figure)?.filedOn ?? null,
        };
      }),
    },
    filings: filingsOf(data.cik, [year.terms.revenue]),
  } satisfies LookupResult;
};

export const glossaryLookup = (name: string): LookupResult => {
  const entry: GlossaryTerm | undefined = findTerm(name);
  if (entry === undefined) {
    throw new LookupProblem({ message: `The glossary has no term "${name}".` });
  }
  return {
    lookup: "glossary",
    title: `Glossary: ${entry.name}`,
    detail: "Definition and example",
    figures: {},
    notes: [`Definition: ${entry.definition}`, `Example: ${entry.example}`],
    drawing: null,
    filings: [],
  };
};

const ticker = {
  type: "string",
  description: "The company's ticker, such as COST.",
} as const;
const fiscalYear = {
  type: "integer",
  description: "A fiscal year. Leave it out for the latest one.",
} as const;

export const catalog = [
  {
    name: "company",
    description:
      "What the company is: its fiscal years collected, when its fiscal year ends, the opening of its business description in its own words, and what the tool does not collect. Use it for what the company does, and before saying the tool cannot answer.",
    inputSchema: {
      type: "object",
      properties: { ticker },
      required: ["ticker"],
    },
  },
  {
    name: "trend",
    description:
      "One or more glossary terms across the last ten fiscal years: each year's figure, each year-over-year change, the compound annual growth rate, how many years it rose, and its largest rise and fall. Set shareOfRevenue to see a term as cents of each dollar of revenue. Set economy to mark the fiscal years of the last recession and of rising interest rates.",
    inputSchema: {
      type: "object",
      properties: {
        ticker,
        terms: {
          type: "array",
          items: { type: "string", enum: trendTerms },
          minItems: 1,
        },
        shareOfRevenue: { type: "boolean" },
        economy: { type: "boolean" },
      },
      required: ["ticker", "terms"],
    },
  },
  {
    name: "dollar",
    description:
      "Where each dollar of revenue went in one fiscal year: each part of the income statement in dollars and as cents of each dollar.",
    inputSchema: {
      type: "object",
      properties: { ticker, fiscalYear },
      required: ["ticker"],
    },
  },
  {
    name: "cash",
    description:
      "Whether net income turns into cash: net income beside free cash flow for the last ten fiscal years, and free cash flow for each dollar of net income.",
    inputSchema: {
      type: "object",
      properties: { ticker },
      required: ["ticker"],
    },
  },
  {
    name: "balance",
    description:
      "What the company owns and owes on the last day of a fiscal year: assets, liabilities, equity, cash, debt and net debt, compared with a year of operating cash flow.",
    inputSchema: {
      type: "object",
      properties: { ticker, fiscalYear },
      required: ["ticker"],
    },
  },
  {
    name: "uses_of_cash",
    description:
      "What the company did with its cash over the last ten fiscal years: capital expenditure, dividends, share buybacks, acquisitions and debt repaid, with totals, and stock-based compensation.",
    inputSchema: {
      type: "object",
      properties: { ticker },
      required: ["ticker"],
    },
  },
  {
    name: "returns",
    description:
      "How well it uses the money put into it: operating income divided by debt plus equity, before tax, for the last ten fiscal years.",
    inputSchema: {
      type: "object",
      properties: { ticker },
      required: ["ticker"],
    },
  },
  {
    name: "context",
    description:
      "What was happening around the company: the interest rate, inflation and recessions over its last five fiscal years, its corporate events, and how revenue and net income changed in recession years and years of rising rates.",
    inputSchema: {
      type: "object",
      properties: { ticker },
      required: ["ticker"],
    },
  },
  {
    name: "marks",
    description:
      "How far to trust the figures: how many are reported, calculated, gaps or doubtful, and one fiscal year's figures with their marks and filing dates.",
    inputSchema: {
      type: "object",
      properties: { ticker, fiscalYear },
      required: ["ticker"],
    },
  },
  {
    name: "glossary",
    description: "A glossary term's definition and example.",
    inputSchema: {
      type: "object",
      properties: { term: { type: "string" } },
      required: ["term"],
    },
  },
] as const;

export type LookupName = (typeof catalog)[number]["name"];

const optionalYear = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) ? value : undefined;

export const runLookup = (
  data: CompanyData,
  name: string,
  input: Readonly<Record<string, unknown>>,
): LookupResult => {
  switch (name) {
    case "company":
      return company(data);
    case "trend":
      return trend(data, {
        terms: Array.isArray(input.terms) ? input.terms.map(String) : [],
        shareOfRevenue: input.shareOfRevenue === true,
        economy: input.economy === true,
      });
    case "dollar":
      return dollar(data, { fiscalYear: optionalYear(input.fiscalYear) });
    case "cash":
      return cash(data);
    case "balance":
      return balance(data, { fiscalYear: optionalYear(input.fiscalYear) });
    case "uses_of_cash":
      return usesOfCash(data);
    case "returns":
      return returns(data);
    case "context":
      return context(data);
    case "marks":
      return marks(data, { fiscalYear: optionalYear(input.fiscalYear) });
    default:
      throw new LookupProblem({
        message: `There is no lookup "${name}". Use one of: ${catalog.map((each) => each.name).join(", ")}.`,
      });
  }
};
