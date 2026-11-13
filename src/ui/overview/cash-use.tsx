import { Link } from "@tanstack/react-router";
import type { StatementYear } from "../../functions/company";
import { valueOf } from "../../shared/figures";
import { money } from "../../shared/format";
import { Term } from "../term";

// Profit on paper and cash in hand can come apart, and what a company does
// with its cash says as much as what it earns. Then where to look next.
export function CashUse({
  ticker,
  name,
  year,
}: {
  readonly ticker: string;
  readonly name: string;
  readonly year: StatementYear;
}) {
  const net = valueOf(year.terms.netIncome);
  const free = valueOf(year.terms.freeCashFlow);
  const revenue = valueOf(year.terms.revenue);
  const per =
    net !== null && free !== null && net > 0 && free > 0
      ? free / net >= 1
        ? `$${(free / net).toFixed(2)}`
        : `${Math.round((free / net) * 100)}¢`
      : null;
  const used = (
    [
      ["capitalExpenditure", "Capital expenditure", "capital expenditure"],
      ["dividends", "Dividend", "dividends"],
      ["shareBuybacks", "Share buyback", "share buybacks"],
      ["acquisitions", "Acquisition", "acquisitions"],
    ] as const
  )
    .map(([key, term, words]) => ({
      key,
      term,
      words,
      value: valueOf(year.terms[key]),
    }))
    .filter(
      (each): each is typeof each & { value: number } => each.value !== null && each.value > 0,
    );
  const repaid = valueOf(year.terms.debtRepaid);
  const left =
    revenue !== null && net !== null && revenue > 0 && net > 0
      ? 100 - Math.round((net / revenue) * 100)
      : null;
  const fiscal = { year: year.fiscalYear };

  return (
    <section className="cash-use" aria-labelledby="cash-title">
      <h2 id="cash-title">
        What {name} did with its cash in fiscal {year.fiscalYear}
      </h2>
      <p className="sentence">
        {per !== null ? (
          <>
            Each dollar of <Term name="Net income">net income</Term> became <strong>{per}</strong>{" "}
            of <Term name="Free cash flow">free cash flow</Term>.{" "}
          </>
        ) : free !== null ? (
          <>
            Its <Term name="Free cash flow">free cash flow</Term> was <strong>{money(free)}</strong>
            .{" "}
          </>
        ) : null}
        {used.length > 0 && (
          <>
            It spent{" "}
            {used.map((each, index) => (
              <span key={each.key}>
                {index > 0 && (index === used.length - 1 ? " and " : ", ")}
                <strong>{money(each.value)}</strong> on <Term name={each.term}>{each.words}</Term>
              </span>
            ))}
            {repaid !== null && repaid > 0 ? (
              <>
                , and repaid <strong>{money(repaid)}</strong> of <Term name="Debt">debt</Term>.
              </>
            ) : (
              "."
            )}
          </>
        )}
      </p>
      <nav className="next" aria-label="Where to look next">
        <Link to="/$ticker/where-the-money-goes" params={{ ticker }} search={fiscal}>
          {left === null
            ? "Where did each dollar go?"
            : `Where did the other ${left}¢ of each dollar go?`}
          <span aria-hidden="true">{"→"}</span>
        </Link>
        <Link to="/$ticker/timeline" params={{ ticker }} search={fiscal}>
          What did it do with its cash over the years?
          <span aria-hidden="true">{"→"}</span>
        </Link>
        <Link to="/$ticker/statements" params={{ ticker }} search={fiscal}>
          Where does each figure come from?
          <span aria-hidden="true">{"→"}</span>
        </Link>
      </nav>
    </section>
  );
}
