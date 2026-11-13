import { max, min } from "d3-array";
import { scaleLinear } from "d3-scale";
import { curveMonotoneX, line as lineShape } from "d3-shape";
import type { Ref } from "react";
import { monthName, rate } from "../../shared/format";
import { Term } from "../term";
import { colors, type Frame, pad, Ticks, TimelineHead } from "./chart-parts";
import { type EconomyMonth, inflationText, middle } from "./time";

const economyHeight = 150;

export function EconomyRow({
  frame,
  months,
  month,
  cursorX,
  economyState,
  ref,
}: {
  readonly frame: Frame;
  readonly months: ReadonlyArray<EconomyMonth>;
  readonly month: string;
  readonly cursorX: number;
  readonly economyState: "loading" | "failed" | "ready";
  readonly ref: Ref<HTMLDivElement>;
}) {
  const { x, width: W } = frame;
  const values = months
    .flatMap((each) => [each.interestRate, each.inflation])
    .filter((value): value is number => value !== null);
  const yEconomy = scaleLinear()
    .domain([Math.min(0, min(values) ?? 0), Math.ceil((max(values) ?? 5) / 5) * 5])
    .range([economyHeight - 4, 12]);
  const economyTicks = yEconomy.ticks(4).filter((tick) => tick % 5 === 0);
  const chosenMonth = months.find((each) => each.month === month);

  return (
    <div className="tl-row" ref={ref}>
      <TimelineHead>
        <span>
          <Term name="Economic context" />, {monthName(month)}
        </span>
        <span className="tl-legend">
          <span>
            <svg viewBox="0 0 14 14">
              <path
                d="M1 7h12"
                stroke="var(--color-line-rate)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <span>
              <Term name="Interest rate" />
              {chosenMonth !== undefined && chosenMonth.interestRate !== null && (
                <span className="numbers">{` ${rate(chosenMonth.interestRate)}`}</span>
              )}
            </span>
          </span>
          <span>
            <svg viewBox="0 0 14 14">
              <path
                d="M1 7h12"
                stroke="var(--color-line-inflation)"
                strokeWidth="2.5"
                strokeDasharray="3 2.5"
              />
            </svg>
            <span>
              <Term name="Inflation" />
              {chosenMonth !== undefined && chosenMonth.inflation !== null && (
                <span className="numbers">{` ${inflationText(chosenMonth.inflation)}`}</span>
              )}
            </span>
          </span>
          <span>
            <svg viewBox="0 0 14 14">
              <rect
                x="1"
                y="1"
                width="12"
                height="12"
                rx="2"
                fill={colors.recession}
                stroke={colors.recessionEdge}
              />
            </svg>
            <span>
              <Term name="Recession" />, shaded in every row
            </span>
          </span>
        </span>
      </TimelineHead>
      {economyState !== "ready" || months.length === 0 ? (
        <p
          className="m-0 flex h-[150px] items-center text-xs text-text-3"
          style={{ paddingLeft: pad.left }}
        >
          {economyState === "loading"
            ? "Fetching interest rate, inflation and recessions from FRED."
            : "Interest rate, inflation and recessions could not be fetched from FRED. They are a gap here until they can be."}
        </p>
      ) : (
        <div className="tl-plot">
          <Ticks
            height={economyHeight}
            ticks={economyTicks.map((tick) => ({
              y: yEconomy(tick),
              text: `${tick}%`,
            }))}
          />
          <svg
            width={W}
            height={economyHeight}
            role="img"
            aria-label="Interest rate and inflation for each month, with recessions shaded"
          >
            {economyTicks.map((tick) => (
              <line
                key={tick}
                className={tick === 0 ? "baseline" : "grid-line"}
                x1={pad.left}
                x2={W - pad.right}
                y1={yEconomy(tick)}
                y2={yEconomy(tick)}
              />
            ))}
            {(["interestRate", "inflation"] as const).map((key) => {
              const path = lineShape<EconomyMonth>()
                .defined((each) => each[key] !== null)
                .x((each) => x(middle(each.month)))
                .y((each) => yEconomy(each[key] ?? 0))
                .curve(curveMonotoneX)(months);
              return (
                <path
                  key={key}
                  d={path ?? ""}
                  fill="none"
                  stroke={
                    key === "interestRate"
                      ? "var(--color-line-rate)"
                      : "var(--color-line-inflation)"
                  }
                  strokeWidth={2}
                  strokeDasharray={key === "inflation" ? "5 3" : undefined}
                  strokeLinejoin="round"
                />
              );
            })}
            {chosenMonth !== undefined &&
              (["interestRate", "inflation"] as const).map((key) =>
                chosenMonth[key] === null ? null : (
                  <circle
                    key={key}
                    cx={cursorX}
                    cy={yEconomy(chosenMonth[key]!)}
                    r={3.5}
                    fill={
                      key === "interestRate"
                        ? "var(--color-line-rate)"
                        : "var(--color-line-inflation)"
                    }
                    stroke="var(--color-surface-1)"
                    strokeWidth={1.5}
                  />
                ),
              )}
          </svg>
        </div>
      )}
    </div>
  );
}
