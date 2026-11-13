import type { KeyboardEvent } from "react";
import { monthName, monthShort } from "../../shared/format";
import { axisHeight, type Frame, isChosen, pad, Pill } from "./chart-parts";
import { colors } from "./kinds";
import { type EconomyMonth, monthAfterKey, monthStart, nextMonth, recessionRuns } from "./time";

// Behind every row: where each fiscal year starts, the chosen one, and recessions.
export function Backdrop({
  frame,
  months,
  height,
}: {
  readonly frame: Frame;
  readonly months: ReadonlyArray<EconomyMonth>;
  readonly height: number;
}) {
  const { spans, span, x, width: W } = frame;
  return (
    <svg className="tl-under" width={W} height={height} aria-hidden="true">
      {spans.map((each) => (
        <line
          key={each.fiscalYear}
          x1={x(each.start)}
          x2={x(each.start)}
          y1={0}
          y2={height}
          stroke="rgb(255 255 255 / 0.05)"
        />
      ))}
      <rect
        x={x(span.start)}
        width={x(span.end) - x(span.start)}
        y={0}
        height={height}
        rx={6}
        fill="rgb(255 255 255 / 0.045)"
      />
      {recessionRuns(months).map((run) => {
        const left = x(monthStart(run[0]!));
        const right = x(nextMonth(run.at(-1)!));
        const width = Math.max(8, right - left);
        const at = (left + right) / 2 - width / 2;
        return (
          <g key={run[0]}>
            <rect x={at} width={width} y={0} height={height} fill={colors.recession} />
            <line
              x1={at}
              x2={at}
              y1={0}
              y2={height}
              stroke={colors.recessionEdge}
              strokeDasharray="2 3"
            />
            <line
              x1={at + width}
              x2={at + width}
              y1={0}
              y2={height}
              stroke={colors.recessionEdge}
              strokeDasharray="2 3"
            />
          </g>
        );
      })}
    </svg>
  );
}

// The line of years under the chart, which the keyboard moves month by month.
export function MonthAxis({
  frame,
  months,
  month,
  cursorX,
  yearShown,
  choose,
}: {
  readonly frame: Frame;
  readonly months: ReadonlyArray<EconomyMonth>;
  readonly month: string;
  readonly cursorX: number;
  readonly yearShown: (index: number) => boolean;
  readonly choose: (month: string) => void;
}) {
  const { spans, span, x, width: W } = frame;
  const monthIndex = months.findIndex((each) => each.month === month);
  const onKey = (event: KeyboardEvent) => {
    const target = monthAfterKey(event.key, monthIndex, months);
    if (target === null) return;
    event.preventDefault();
    choose(target);
  };
  return (
    <div
      className="tl-axis"
      role="slider"
      tabIndex={0}
      aria-label="Month on the timeline"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, months.length - 1)}
      aria-valuenow={Math.max(0, monthIndex)}
      aria-valuetext={`${monthName(month)}, fiscal ${span.fiscalYear}`}
      onKeyDown={onKey}
    >
      <svg width={W} height={axisHeight} aria-hidden="true">
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={0.5}
          y2={0.5}
          stroke="var(--color-hairline-strong)"
        />
        {spans.map((each, index) => (
          <g key={each.fiscalYear}>
            <line
              x1={x(each.start)}
              x2={x(each.start)}
              y1={0}
              y2={8}
              stroke="var(--color-text-3)"
              opacity={0.6}
            />
            <text
              className={`tl-year ${isChosen(frame, each) ? "current" : ""}`}
              x={(x(each.start) + x(each.end)) / 2}
              y={22}
              textAnchor="middle"
              opacity={yearShown(index) ? 1 : 0}
            >
              {each.fiscalYear}
            </text>
          </g>
        ))}
        <Pill x={cursorX} width={W} text={monthShort(month)} />
      </svg>
    </div>
  );
}

// Over every row: the chosen month, and the month under the pointer.
export function Cursor({
  width,
  height,
  top,
  cursorX,
  hover,
}: {
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly cursorX: number;
  readonly hover: number | null;
}) {
  return (
    <svg className="tl-over" width={width} height={height} aria-hidden="true">
      {hover !== null && (
        <line
          x1={hover}
          x2={hover}
          y1={top}
          y2={height - axisHeight}
          stroke="var(--color-text-3)"
          strokeDasharray="2 3"
        />
      )}
      <line
        x1={cursorX}
        x2={cursorX}
        y1={top}
        y2={height - axisHeight + 28}
        stroke="var(--color-text-1)"
        strokeWidth={1.5}
      />
    </svg>
  );
}
