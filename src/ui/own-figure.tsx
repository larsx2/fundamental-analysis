import type { StatementYear } from "../functions/company";
import { type CheckedFigure, valueOf } from "../shared/figures";
import { filingUrl, longDate, money, percent, perShare } from "./format";
import { CalculatedMark, DoubtfulMark, GapMark } from "./marks";

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

const sumText = (figure: Extract<CheckedFigure, { kind: "calculated" }>, key: FigureKey) => {
  if (figure.how !== undefined) return figure.how;
  if (ratioKeys.has(key)) {
    const [part, whole] = figure.from;
    return part === undefined || whole === undefined
      ? ""
      : `${part.name} ${money(part.value)} divided by ${whole.name.toLowerCase()} ${money(whole.value)}.`;
  }
  return `${figure.from
    .filter((each, index) => index === 0 || each.value !== 0)
    .map((each, index) => {
      const amount = money(Math.abs(each.value));
      const name = index === 0 ? each.name : each.name.toLowerCase();
      if (index === 0) return `${each.value < 0 ? "minus " : ""}${name} ${amount}`;
      return `${each.value < 0 ? " minus" : " plus"} ${name} ${amount}`;
    })
    .join("")}.`;
};

// The notes under a figure: where it came from, and any mark it carries.
export function FigureNotes({
  figure,
  figureKey,
  cik,
  companyName,
  termName,
}: {
  readonly figure: CheckedFigure;
  readonly figureKey: FigureKey;
  readonly cik: number;
  readonly companyName: string;
  readonly termName: string;
}) {
  if (figure.kind === "gap") {
    return (
      <p className="note">
        <GapMark /> {companyName} does not report {termName.toLowerCase()} as its own line in this
        annual report, so nothing is shown for it. It is not zero.
      </p>
    );
  }
  return (
    <>
      {figure.kind === "calculated" ? (
        <p className="note">
          <CalculatedMark /> Worked out by the tool: {sumText(figure, figureKey)}
          {figure.latest !== undefined && (
            <>
              {" "}
              <a href={filingUrl(cik, figure.latest.accession)} target="_blank" rel="noreferrer">
                Open the filing
              </a>
            </>
          )}
        </p>
      ) : (
        <p className="note">
          Reported in the annual report (10-K) filed on {longDate(figure.latest.filedOn)}.{" "}
          <a href={filingUrl(cik, figure.latest.accession)} target="_blank" rel="noreferrer">
            Open the filing
          </a>
          {figure.original.accession !== figure.latest.accession &&
            figure.original.value !== figure.latest.value && (
              <>
                {" "}
                First filed as {formatValue(figureKey, figure.original.value)} on{" "}
                {longDate(figure.original.filedOn)}, then restated. The newest value is shown.
              </>
            )}
        </p>
      )}
      {figure.kind === "calculated" && figure.setAside !== null && (
        <p className="note">
          <DoubtfulMark /> {companyName} filed {money(figure.setAside.value)} as its{" "}
          {termName.toLowerCase()} this year. {figure.setAside.doubtful} That filed figure is kept
          here and the calculated one is used.{" "}
          <a href={filingUrl(cik, figure.setAside.accession)} target="_blank" rel="noreferrer">
            Open the filing
          </a>
        </p>
      )}
      {figure.doubtful !== null && (
        <p className="note">
          <DoubtfulMark /> {figure.doubtful}
        </p>
      )}
    </>
  );
}

// The line on a term card with this company's own figure for the fiscal year shown.
export function ownFigureLine({
  termName,
  year,
  cik,
  companyName,
}: {
  readonly termName: string;
  readonly year: StatementYear;
  readonly cik: number;
  readonly companyName: string;
}) {
  const key = keyOfTerm[termName];
  if (key === undefined) return null;
  const figure = figureOf(year, key);
  const value = valueOf(figure);
  const revenue = valueOf(year.terms.revenue);
  const lead = `${companyName} in fiscal ${year.fiscalYear}: `;
  return (
    <>
      <div className="figure-line">
        {lead}
        {value === null ? (
          <GapMark />
        ) : (
          <>
            <span className="numbers">{formatValue(key, value)}</span>
            {incomeKeys.has(key) && key !== "revenue" && revenue !== null && revenue !== 0
              ? `, ${percent(value / revenue)} of revenue`
              : balanceKeys.has(key)
                ? ", on the last day of the fiscal year"
                : ""}
          </>
        )}
      </div>
      <FigureNotes
        figure={figure}
        figureKey={key}
        cik={cik}
        companyName={companyName}
        termName={termName}
      />
    </>
  );
}
