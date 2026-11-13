import type { StatementYear } from "../functions/company";
import {
  balanceKeys,
  type FigureKey,
  figureOf,
  formatValue,
  incomeKeys,
  keyOfTerm,
  ratioKeys,
} from "../shared/figure-keys";
import { type CheckedFigure, valueOf } from "../shared/figures";
import { filingUrl, longDate, money, percent } from "../shared/format";
import { CalculatedMark, DoubtfulMark, GapMark } from "./marks";

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
