import type { LookupResult } from "../../shared/lookups";
import { type CompanyData, LookupProblem } from "./lookups/common";
import { company } from "./lookups/company";
import { trendTerms, trend } from "./lookups/trend";
import { dollar } from "./lookups/dollar";
import { cash } from "./lookups/cash";
import { balance } from "./lookups/balance";
import { usesOfCash } from "./lookups/uses-of-cash";
import { returns } from "./lookups/returns";
import { context } from "./lookups/context";
import { marks } from "./lookups/marks";

export { type CompanyData, LookupProblem } from "./lookups/common";
export { glossaryLookup } from "./lookups/glossary";

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
      "What was happening around the company: the interest rate, inflation and recessions over its last five fiscal years, its corporate events, and how revenue and net income changed in recession years and years when the interest rate rose.",
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
    name: "search_report",
    description:
      'Searches the company\'s latest annual report (10-K) and returns up to 8 whole paragraphs with their line numbers. Words match by stem, so a prefix such as compet* matches every form; OR, AND, NOT, "phrases" and NEAR(a b, 10) work too.',
    inputSchema: {
      type: "object",
      properties: { ticker, query: { type: "string" } },
      required: ["ticker", "query"],
    },
  },
  {
    name: "read_report",
    description:
      "Returns the paragraphs of the latest annual report that start at a line number, for the text around a search result.",
    inputSchema: {
      type: "object",
      properties: { ticker, line: { type: "integer" }, count: { type: "integer" } },
      required: ["ticker", "line"],
    },
  },
  {
    name: "risk_headings",
    description:
      "The headings of the risk factors in the latest annual report, each with its line number.",
    inputSchema: {
      type: "object",
      properties: { ticker },
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
