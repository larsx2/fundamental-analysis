import { max, min } from "d3-array";
import { scaleLinear, scalePoint } from "d3-scale";
import { curveMonotoneX, line as lineShape } from "d3-shape";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import type { StatementYear } from "../../functions/company";
import { valueOf } from "../../shared/figures";
import { axisMoney, money, moneyShort } from "../../shared/format";
import { useChartTip } from "../chart-tip";
import { glide, useMounted, useStill, useWidth } from "../motion";
import { Term } from "../term";

// Revenue and net income are drawn as two charts that share the fiscal
// years, each with its own dollar scale. On one scale, net income lies flat
// along the bottom for a company like Costco, which keeps about 3¢ of each
// dollar, and its growth cannot be seen.
const series = [
  {
    key: "revenue",
    name: "Revenue",
    color: "var(--color-text-1)",
  },
  {
    key: "netIncome",
    name: "Net income",
    color: "var(--color-part-kept)",
  },
] as const;

type Series = (typeof series)[number];

export function Lines({
  name,
  years,
  year,
  onChoose,
}: {
  readonly name: string;
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
  readonly onChoose: (fiscalYear: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const tip = useChartTip();
  const [hovered, setHovered] = useState<number | null>(null);
  const width = Math.max(260, useWidth(box));
  const side = width >= 760;
  const gap = 32;
  const chartWidth = side ? (width - gap) / 2 : width;
  const height = side ? 300 : 220;
  const reserved = side ? height + 36 : (height + 36) * 2 + gap;
  if (!mounted) return <div ref={box} style={{ height: reserved }} />;

  const hover = (event: { clientX: number; clientY: number }, point: StatementYear) => {
    setHovered(point.fiscalYear);
    tip.show(
      event,
      <>
        <strong className="tip-title">Fiscal {point.fiscalYear}</strong>
        {series.map((each) => {
          const value = valueOf(point.terms[each.key]);
          return (
            <span key={each.key} className="tip-row">
              <i style={{ background: each.color }} />
              <strong>{value === null ? "gap" : money(value)}</strong>
              <span>{each.name}</span>
            </span>
          );
        })}
      </>,
    );
  };
  const leave = () => {
    setHovered(null);
    tip.hide();
  };

  return (
    <div ref={box} className={`multiples ${side ? "side" : ""}`} onMouseLeave={leave}>
      {series.map((each) => (
        <Multiple
          key={each.key}
          name={name}
          each={each}
          years={years}
          year={year}
          hovered={hovered}
          width={chartWidth}
          height={height}
          onHover={hover}
          onChoose={onChoose}
        />
      ))}
      {tip.element}
    </div>
  );
}

function Multiple({
  name,
  each,
  years,
  year,
  hovered,
  width,
  height,
  onHover,
  onChoose,
}: {
  readonly name: string;
  readonly each: Series;
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
  readonly hovered: number | null;
  readonly width: number;
  readonly height: number;
  readonly onHover: (event: { clientX: number; clientY: number }, point: StatementYear) => void;
  readonly onChoose: (fiscalYear: number) => void;
}) {
  const still = useStill();
  const narrow = width < 420;
  const margin = { top: 24, right: 12, bottom: 32, left: narrow ? 46 : 54 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const values = years.map((point) => valueOf(point.terms[each.key]));
  const known = values.filter((value): value is number => value !== null);
  const x = scalePoint<number>()
    .domain(years.map((point) => point.fiscalYear))
    .range([0, innerWidth])
    .padding(0.3);
  const y = scaleLinear()
    .domain([Math.min(0, min(known) ?? 0), Math.max(0, max(known) ?? 1)])
    .range([innerHeight, 0])
    .nice(6);
  const transition = still ? { duration: 0 } : glide;
  const at = (point: StatementYear) => x(point.fiscalYear) ?? 0;
  const valueAt = (point: StatementYear) => valueOf(point.terms[each.key]);
  const line = lineShape<StatementYear>()
    .defined((point) => valueAt(point) !== null)
    .x(at)
    .y((point) => y(valueAt(point) ?? 0))
    .curve(curveMonotoneX)(years);
  const chosen = valueAt(year);
  const cx = at(year);
  const cy = chosen === null ? null : y(chosen);
  const labelLeft = cx > innerWidth - 80;
  const labelBelow = cy !== null && cy < 22;
  const shown = years.find((point) => point.fiscalYear === hovered);
  const shownValue = shown === undefined ? null : valueAt(shown);

  const chosenIndex = years.indexOf(year);
  const every = Math.max(1, Math.ceil(years.length / Math.max(2, Math.floor(innerWidth / 64))));
  const lastIndex = years.length - 1;
  const showYear = (index: number) => {
    if (index === chosenIndex) return true;
    if (Math.abs(index - chosenIndex) < every) return false;
    return index % every === lastIndex % every;
  };

  return (
    <figure className="multiple">
      <figcaption>
        <i style={{ background: each.color }} aria-hidden="true" />
        <Term name={each.name} />
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`${name}'s ${each.name.toLowerCase()} from fiscal ${years[0]?.fiscalYear} to fiscal ${years.at(-1)?.fiscalYear}${chosen === null ? "" : `, ${money(chosen)} in fiscal ${year.fiscalYear}`}.`}
        className="block overflow-visible"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {y.ticks(3).map((tick) => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              <line className={tick === 0 ? "baseline" : "grid-line"} x1={0} x2={innerWidth} />
              <text className="axis-text" x={-10} textAnchor="end" dy="0.32em">
                {axisMoney(tick)}
              </text>
            </g>
          ))}
          <motion.path
            d={line ?? ""}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ stroke: each.color }}
            initial={still ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={still ? { duration: 0 } : { duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.line
            initial={false}
            animate={{ x1: cx, x2: cx }}
            y1={0}
            y2={innerHeight}
            transition={transition}
            className="chosen-line"
          />
          {shown !== undefined && shown !== year && (
            <g>
              <line className="hover-line" x1={at(shown)} x2={at(shown)} y1={0} y2={innerHeight} />
              {shownValue !== null && (
                <circle
                  cx={at(shown)}
                  cy={y(shownValue)}
                  r={4}
                  style={{ fill: each.color }}
                  stroke="var(--color-surface-1)"
                  strokeWidth={2}
                />
              )}
            </g>
          )}
          {cy !== null && chosen !== null && (
            <>
              <motion.circle
                initial={false}
                animate={{ cx, cy }}
                transition={transition}
                r={4.5}
                style={{ fill: each.color }}
                stroke="var(--color-surface-1)"
                strokeWidth={2}
              />
              <motion.text
                className="value-text"
                textAnchor={labelLeft ? "end" : "start"}
                initial={false}
                animate={{
                  x: cx + (labelLeft ? -10 : 10),
                  y: labelBelow ? cy + 20 : cy - 10,
                }}
                transition={transition}
              >
                {moneyShort(chosen)}
              </motion.text>
            </>
          )}
          {years.map((point, index) => (
            <text
              key={point.fiscalYear}
              className={`year-text ${point === year ? "current" : ""}`}
              textAnchor="middle"
              x={at(point)}
              y={innerHeight + 22}
              opacity={showYear(index) ? 1 : 0}
            >
              {point.fiscalYear}
            </text>
          ))}
          {years.map((point) => (
            <rect
              key={point.fiscalYear}
              x={at(point) - x.step() / 2}
              width={x.step()}
              y={-margin.top}
              height={innerHeight + margin.top + 30}
              fill="transparent"
              className="cursor-pointer"
              onMouseMove={(event) => onHover(event, point)}
              onClick={() => onChoose(point.fiscalYear)}
            />
          ))}
        </g>
      </svg>
    </figure>
  );
}
