import { Link } from "@tanstack/react-router";
import type { StatementYear } from "../../functions/company";
import { valueOf } from "../../shared/figures";
import { centsOfDollar } from "../../shared/format";
import { yearParts } from "../../shared/money-flow-parts";
import { Term } from "../term";

// One dollar of revenue split into the parts it went to, the picture of the
// sentence above it. The whole bar opens Where the money goes.
const labelInside = 8;

export function DollarBar({
  ticker,
  year,
}: {
  readonly ticker: string;
  readonly year: StatementYear;
}) {
  const revenue = valueOf(year.terms.revenue);
  const net = valueOf(year.terms.netIncome);
  if (revenue === null || revenue <= 0 || net === null || net <= 0) return null;
  const all = yearParts(year);
  const cents = centsOfDollar(
    all.map((part) => part.value),
    revenue,
  );
  const blocks = all
    .map((part, index) => ({ part, cents: cents[index] ?? 0 }))
    .filter(({ part, cents: share }) => part.value !== null && part.value > 0 && share > 0);
  const destination = {
    to: "/$ticker/where-the-money-goes",
    params: { ticker },
    search: { year: year.fiscalYear },
  } as const;

  return (
    <section className="dollar" aria-labelledby="dollar-title">
      <div className="dollar-head">
        <h2 id="dollar-title">
          Each dollar of <Term name="Revenue">revenue</Term> in fiscal {year.fiscalYear}
        </h2>
        <Link {...destination} className="more-link">
          Where the money goes {"→"}
        </Link>
      </div>
      <Link
        {...destination}
        className="dollar-bar"
        aria-label={`${blocks.map(({ part, cents: share }) => `${part.name} ${share}¢`).join(", ")}. Opens where the money goes.`}
      >
        {blocks.map(({ part, cents: share }) => (
          <span
            key={part.key}
            style={{
              flexGrow: share,
              background: part.color,
              color:
                part.key === "netIncome"
                  ? "var(--color-text-on-kept)"
                  : "var(--color-text-on-part)",
            }}
          >
            {share >= labelInside ? `${share}¢` : ""}
          </span>
        ))}
      </Link>
      <ul className="dollar-legend">
        {blocks.map(({ part, cents: share }) => (
          <li key={part.key}>
            <i style={{ background: part.color }} aria-hidden="true" />
            <Term name={part.name} />
            {share < labelInside && <span className="numbers">{share}¢</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
