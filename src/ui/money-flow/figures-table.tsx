import type { StatementYear } from "../../functions/company";
import { type CheckedFigure, valueOf } from "../../shared/figures";
import { moneyShort, percent, signedPercent, yearOverYear } from "../../shared/format";
import { Marks } from "../marks";
import { type FigureKey, figureOf } from "../../shared/figure-keys";
import { Term } from "../term";
import { parts } from "../../shared/money-flow-parts";

const rows: ReadonlyArray<{
  readonly key: FigureKey;
  readonly term: string;
  readonly subtotal: boolean;
}> = [
  { key: "revenue", term: "Revenue", subtotal: true },
  { key: "costOfRevenue", term: "Cost of revenue", subtotal: false },
  { key: "grossProfit", term: "Gross profit", subtotal: true },
  {
    key: "researchAndDevelopment",
    term: "Research and development",
    subtotal: false,
  },
  {
    key: "sellingGeneralAndAdministrative",
    term: "Selling, general and administrative",
    subtotal: false,
  },
  {
    key: "otherOperatingExpenses",
    term: "Other operating expenses",
    subtotal: false,
  },
  { key: "operatingIncome", term: "Operating income", subtotal: true },
  { key: "below", term: "Interest, other income and tax", subtotal: false },
  { key: "netIncome", term: "Net income", subtotal: false },
];

const colorOf = new Map<FigureKey, string>(parts.map((part) => [part.key, part.color]));

// The table view of the money flow: dollars, share of revenue and the change
// against the fiscal year before, digit under digit.
export function FiguresTable({
  year,
  previous,
}: {
  readonly year: StatementYear;
  readonly previous: StatementYear | undefined;
}) {
  const revenue = valueOf(year.terms.revenue);
  const change = (key: FigureKey, figure: CheckedFigure) => {
    if (previous === undefined) return null;
    const delta = yearOverYear(valueOf(figure), valueOf(figureOf(previous, key)));
    return delta === null ? null : signedPercent(delta);
  };
  return (
    <>
      <div className="table-scroll">
        <table className="figures parts-table">
          <caption className="visually-hidden">
            Where each dollar went in fiscal {year.fiscalYear}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Term</span>
              </th>
              <th scope="col">Dollars</th>
              <th scope="col">Share</th>
              <th scope="col">{previous === undefined ? "" : `Since ${previous.fiscalYear}`}</th>
              <th scope="col">
                <span className="visually-hidden">Marks</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const figure = figureOf(year, row.key);
              const value = valueOf(figure);
              const color = colorOf.get(row.key);
              return (
                <tr key={row.key} className={row.subtotal ? "subtotal" : undefined}>
                  <th scope="row" className="py-[9px] text-left font-[inherit] text-[inherit]">
                    <span className="inline-flex items-baseline gap-2.5">
                      {color !== undefined && (
                        <span className="swatch" style={{ background: color }} aria-hidden="true" />
                      )}
                      <Term name={row.term} />
                    </span>
                  </th>
                  <td className="text-text-1">{value === null ? "" : moneyShort(value)}</td>
                  <td className="share">
                    {value === null || revenue === null || revenue === 0
                      ? ""
                      : percent(value / revenue)}
                  </td>
                  <td>
                    <span className="change">{change(row.key, figure)}</span>
                  </td>
                  <td className="w-[1%] whitespace-nowrap">
                    <Marks figure={figure} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 mb-0 text-xs text-text-3">
        B means billions of dollars and M millions.{" "}
        <Term name="Year-over-year change">The change</Term> is against the fiscal year before.
        Every term opens its glossary card, with the filing its number came from.
      </p>
    </>
  );
}
