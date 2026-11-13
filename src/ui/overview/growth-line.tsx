import type { ReactNode } from "react";
import type { StatementYear } from "../../functions/company";
import { valueOf } from "../../shared/figures";
import { money, percent } from "../../shared/format";
import { Term } from "../term";

export const growthLine = (range: ReadonlyArray<StatementYear>): ReactNode => {
  const first = range[0];
  const last = range.at(-1);
  if (first === undefined || last === undefined || first === last) return null;
  const span = last.fiscalYear - first.fiscalYear;
  const rateOf = (a: number | null, b: number | null) =>
    a !== null && b !== null && a > 0 && b > 0 ? percent((b / a) ** (1 / span) - 1) : null;
  const revenueRate = rateOf(valueOf(first.terms.revenue), valueOf(last.terms.revenue));
  const netThen = valueOf(first.terms.netIncome);
  const netNow = valueOf(last.terms.netIncome);
  const netRate = rateOf(netThen, netNow);
  const net =
    netRate !== null
      ? `net income at ${netRate}`
      : netThen !== null && netNow !== null && netThen <= 0 && netNow > 0
        ? `net income went from a loss of ${money(-netThen)} to ${money(netNow)}`
        : netNow !== null && netNow <= 0
          ? `net income was a loss of ${money(-netNow)} in fiscal ${last.fiscalYear}`
          : null;
  if (revenueRate === null && net === null) return null;
  return (
    <>
      From fiscal {first.fiscalYear} to fiscal {last.fiscalYear},{" "}
      {revenueRate === null ? (
        `${net}.`
      ) : (
        <>
          revenue grew at a{" "}
          <Term name="Compound annual growth rate">compound annual growth rate</Term> of{" "}
          {revenueRate}
          {net === null ? "." : `, and ${net}.`}
        </>
      )}
    </>
  );
};
