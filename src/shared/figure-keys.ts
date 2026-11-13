import type { StatementYear } from "../server/terms/statements";
import { type CheckedFigure, valueOf } from "./figures";
import { money, percent, perShare } from "./format";

export type FigureKey = keyof StatementYear["terms"] | "below" | "interestAndOther";

// Which number each glossary term stands for on a company screen.
export const keyOfTerm: Record<string, FigureKey> = {
  Revenue: "revenue",
  "Cost of revenue": "costOfRevenue",
  "Gross profit": "grossProfit",
  "Research and development": "researchAndDevelopment",
  "Selling, general and administrative": "sellingGeneralAndAdministrative",
  "Other operating expenses": "otherOperatingExpenses",
  "Operating income": "operatingIncome",
  "Interest, other income and tax": "below",
  "Income tax": "incomeTax",
  "Interest and other income": "interestAndOther",
  "Net income": "netIncome",
  "Earnings per share": "earningsPerShare",
  "Gross margin": "grossMargin",
  "Operating margin": "operatingMargin",
  Margin: "netMargin",
  Cash: "cash",
  Receivables: "receivables",
  Inventory: "inventory",
  "Property, plant and equipment": "propertyPlantAndEquipment",
  Goodwill: "goodwill",
  Asset: "assets",
  Liability: "liabilities",
  Equity: "equity",
  Debt: "debt",
  "Net debt": "netDebt",
  "Operating cash flow": "operatingCashFlow",
  "Depreciation and amortization": "depreciationAndAmortization",
  "Stock-based compensation": "stockBasedCompensation",
  "Capital expenditure": "capitalExpenditure",
  "Free cash flow": "freeCashFlow",
  Dividend: "dividends",
  "Share buyback": "shareBuybacks",
  Acquisition: "acquisitions",
};

export const ratioKeys = new Set<FigureKey>(["grossMargin", "operatingMargin", "netMargin"]);
export const balanceKeys = new Set<FigureKey>([
  "cash",
  "receivables",
  "inventory",
  "propertyPlantAndEquipment",
  "goodwill",
  "assets",
  "liabilities",
  "equity",
  "debt",
  "netDebt",
]);
export const incomeKeys = new Set<FigureKey>([
  "revenue",
  "costOfRevenue",
  "grossProfit",
  "researchAndDevelopment",
  "sellingGeneralAndAdministrative",
  "otherOperatingExpenses",
  "operatingIncome",
  "below",
  "incomeTax",
  "interestAndOther",
  "netIncome",
]);

// Everything between operating income and net income, worked out by the tool.
export const belowOperatingIncome = (year: StatementYear): CheckedFigure => {
  const operating = valueOf(year.terms.operatingIncome);
  const net = valueOf(year.terms.netIncome);
  if (operating === null || net === null) return { kind: "gap", doubtful: null };
  return {
    kind: "calculated",
    value: operating - net,
    from: [
      { name: "Operating income", value: operating },
      { name: "Net income", value: -net },
    ],
    setAside: null,
    doubtful: null,
  };
};

export const interestAndOtherIncome = (year: StatementYear): CheckedFigure => {
  const operating = valueOf(year.terms.operatingIncome);
  const net = valueOf(year.terms.netIncome);
  const tax = valueOf(year.terms.incomeTax);
  if (operating === null || net === null || tax === null) return { kind: "gap", doubtful: null };
  return {
    kind: "calculated",
    value: net - operating + tax,
    from: [
      { name: "Net income", value: net },
      { name: "Operating income", value: -operating },
      { name: "Income tax", value: tax },
    ],
    setAside: null,
    doubtful: null,
  };
};

export const figureOf = (year: StatementYear, key: FigureKey): CheckedFigure =>
  key === "below"
    ? belowOperatingIncome(year)
    : key === "interestAndOther"
      ? interestAndOtherIncome(year)
      : year.terms[key];

export const formatValue = (key: FigureKey, value: number) =>
  ratioKeys.has(key) ? percent(value) : key === "earningsPerShare" ? perShare(value) : money(value);
