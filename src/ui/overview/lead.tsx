import type { StatementYear } from "../../functions/company";
import { valueOf } from "../../shared/figures";
import { money } from "../../shared/format";
import { Term } from "../term";
import { grewText, netIncomeMove } from "./words";

// What the company is and whether it is growing, worked out from its numbers.
// Net income is what is left of each dollar, not money the company keeps:
// most of it goes back out as dividends, buybacks and investment.
export function Lead({
  name,
  years,
  year,
}: {
  readonly name: string;
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
}) {
  const before = years.find((each) => each.fiscalYear === year.fiscalYear - 1);
  const revenue = valueOf(year.terms.revenue);
  const net = valueOf(year.terms.netIncome);
  const left =
    revenue !== null && net !== null && revenue > 0 && net > 0
      ? Math.round((net / revenue) * 100)
      : null;
  const revenueMove =
    before === undefined ? null : grewText(revenue, valueOf(before.terms.revenue));
  const netMove = before === undefined ? null : netIncomeMove(net, valueOf(before.terms.netIncome));

  const whole = (value: number) => money(value).replace(" ", "\u00a0");
  return (
    <section aria-label="In plain words">
      <p className="overview-lead">
        {revenue === null
          ? `${name}'s revenue for fiscal ${year.fiscalYear} is a gap.`
          : net !== null && net < 0
            ? `${name} brought in ${whole(revenue)} in fiscal ${year.fiscalYear} and lost ${whole(-net)}.`
            : left !== null
              ? `${name} brought in ${whole(revenue)} in fiscal ${year.fiscalYear} and had ${left}¢ of each dollar left as net income.`
              : `${name} brought in ${whole(revenue)} in fiscal ${year.fiscalYear}.`}
      </p>
      {before !== undefined && revenueMove !== null && (
        <p className="sentence">
          Since fiscal {before.fiscalYear}, its <Term name="Revenue">revenue</Term> {revenueMove}
          {netMove === null ? (
            "."
          ) : (
            <>
              {" "}
              and its <Term name="Net income">net income</Term> {netMove}.
            </>
          )}
        </p>
      )}
    </section>
  );
}
