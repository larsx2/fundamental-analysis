import type { Drawing } from "../../../shared/lookups";
import { longDate, money, moneyShort } from "../../../shared/format";
import { CalculatedMark, DoubtfulMark, GapMark } from "../../marks";
import { findTerm } from "../../../glossary/glossary";
import { Term } from "../../term";
import { type Tip, Caption } from "./chart-parts";
import { LineChart } from "./line-chart";
import { BarChart } from "./bar-chart";
import { EconomyChart } from "./economy-chart";

const partColors: Record<string, string> = {
  costOfRevenue: "var(--color-part-cost)",
  researchAndDevelopment: "var(--color-part-research)",
  sellingGeneralAndAdministrative: "var(--color-part-selling)",
  otherOperatingExpenses: "var(--color-part-other)",
  below: "var(--color-part-below)",
  netIncome: "var(--color-part-kept)",
};

export function Body({
  drawing,
  width,
  tip,
  linked,
}: {
  readonly drawing: Drawing;
  readonly width: number;
  readonly tip: Tip;
  readonly linked: ReadonlySet<string>;
}) {
  switch (drawing.kind) {
    case "lines": {
      const groups = drawing.apart ? drawing.series.map((each) => [each]) : [drawing.series];
      const side = drawing.apart && width >= 680;
      const chartWidth = side ? (width - 32) / groups.length : width;
      return (
        <div className={`multiples ${side ? "side" : ""}`}>
          {groups.map((group) => (
            <figure key={group.map((each) => each.name).join()} className="multiple">
              <Caption series={group} />
              <LineChart
                series={group}
                unit={drawing.unit}
                shade={drawing.shade}
                width={chartWidth}
                tip={tip}
              />
            </figure>
          ))}
        </div>
      );
    }
    case "bars":
      if (drawing.rows) {
        return (
          <div className="ask-rows">
            {drawing.series.map((each) => (
              <figure key={each.name} className="multiple">
                <figcaption>
                  {each.term === null ? each.name : <Term name={each.term}>{each.name}</Term>}
                </figcaption>
                <BarChart
                  series={[each]}
                  unit={drawing.unit}
                  width={width}
                  height={96}
                  highlightLast
                  tip={tip}
                />
              </figure>
            ))}
          </div>
        );
      }
      return (
        <figure className="multiple">
          {drawing.series.length > 1 && <Caption series={drawing.series} />}
          <BarChart
            series={drawing.series}
            unit={drawing.unit}
            width={width}
            height={200}
            highlightLast={drawing.series.length === 1}
            tip={tip}
          />
        </figure>
      );
    case "dollar":
      return (
        <>
          <div
            className="dollar-bar"
            role="img"
            aria-label={drawing.parts.map((part) => `${part.name} ${part.cents} cents`).join(", ")}
          >
            {drawing.parts.map((part) => (
              <span
                key={part.key}
                style={{ flexGrow: Math.max(part.cents, 0), background: partColors[part.key] }}
              />
            ))}
          </div>
          <ul className="ask-receipt">
            {drawing.parts.map((part) => (
              <li key={part.key} className={part.key === "netIncome" ? "kept" : undefined}>
                <i style={{ background: partColors[part.key] }} aria-hidden="true" />
                {linked.has(findTerm(part.name)?.name ?? part.name) ? (
                  <span>{part.name}</span>
                ) : (
                  <Term name={part.name} />
                )}
                <span className="numbers">{part.cents}¢</span>
              </li>
            ))}
          </ul>
        </>
      );
    case "balance": {
      const block = (value: number, color: string, label: string, term: string) =>
        value > 0 && (
          <span style={{ flexGrow: value, background: color }}>
            {value / drawing.assets > 0.2 && (
              <>
                {label} {moneyShort(value)}
              </>
            )}
            <span className="visually-hidden">
              <Term name={term}>{label}</Term> {money(value)}
            </span>
          </span>
        );
      return (
        <div className="ask-balance">
          <div>
            <span className="ask-balance-label">What it owns</span>
            <div className="ask-balance-bar">
              {block(drawing.assets, "var(--color-text-2)", "Assets", "Asset")}
            </div>
          </div>
          <div>
            <span className="ask-balance-label">What it owes, and what is left for its owners</span>
            <div className="ask-balance-bar">
              {block(drawing.liabilities, "var(--color-bar-neutral)", "Liabilities", "Liability")}
              {drawing.equity !== null &&
                block(drawing.equity, "var(--color-part-kept)", "Equity", "Equity")}
            </div>
          </div>
        </div>
      );
    }
    case "economy":
      return (
        <>
          <figure className="multiple">
            <figcaption>
              <span className="ask-key">
                <i style={{ background: "var(--color-line-rate)" }} aria-hidden="true" />
                <Term name="Interest rate" />
              </span>
              <span className="ask-key">
                <i
                  className="dashed"
                  style={{ borderColor: "var(--color-line-inflation)" }}
                  aria-hidden="true"
                />
                <Term name="Inflation" />
              </span>
              <span className="ask-key">
                <i className="dot" aria-hidden="true" />
                <Term name="Corporate event">Corporate events</Term>
              </span>
            </figcaption>
            <EconomyChart drawing={drawing} width={width} tip={tip} />
          </figure>
          {drawing.events.length > 0 && (
            <ul className="ask-events">
              {drawing.events
                .slice(-4)
                .reverse()
                .map((event) => (
                  <li key={`${event.date}-${event.url}`}>
                    <span>
                      {event.title}.{" "}
                      <a href={event.url} target="_blank" rel="noreferrer">
                        Open the filing
                      </a>
                    </span>
                    <time dateTime={event.date}>{longDate(event.date)}</time>
                  </li>
                ))}
            </ul>
          )}
        </>
      );
    case "marks":
      return (
        <div className="table-scroll">
          <table className="figures">
            <thead>
              <tr>
                <th scope="col">Figure</th>
                <th scope="col">Dollars</th>
                <th scope="col">Filed</th>
                <th scope="col">Mark</th>
              </tr>
            </thead>
            <tbody>
              {drawing.rows.map((row) => (
                <tr key={row.name}>
                  <th scope="row">
                    <Term name={row.name} />
                  </th>
                  <td className="numbers">{row.value}</td>
                  <td className="share">{row.filedOn === null ? "" : longDate(row.filedOn)}</td>
                  <td>
                    {row.mark === "gap" ? (
                      <GapMark />
                    ) : row.mark === "doubtful" ? (
                      <DoubtfulMark />
                    ) : row.mark === "calculated" ? (
                      <CalculatedMark />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "quote":
      return (
        <div className="quote">
          <blockquote cite={drawing.url}>
            <p>{drawing.text}</p>
          </blockquote>
          <p className="source">
            {drawing.source}{" "}
            <a href={drawing.url} target="_blank" rel="noreferrer">
              Read it in the filing ↗
            </a>
          </p>
        </div>
      );
  }
}
