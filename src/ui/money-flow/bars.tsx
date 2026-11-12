import { scaleBand, scaleLinear } from "d3-scale";
import { motion } from "motion/react";
import { useRef } from "react";
import type { StatementYear } from "../../functions/company";
import { useChartTip } from "../chart-tip";
import { axisMoney, money, percent } from "../format";
import { glide, useMounted, useStill, useWidth } from "../motion";
import { keptShare, type PartKey, revenueOf, yearParts } from "./parts";

const height = 440;
const margin = { top: 16, right: 8, bottom: 64, left: 52 };

// Net income sits on the baseline, so what was kept is the part read first.
const stackOrder: ReadonlyArray<PartKey> = [
  "netIncome",
  "below",
  "otherOperatingExpenses",
  "sellingGeneralAndAdministrative",
  "researchAndDevelopment",
  "costOfRevenue",
];

export type Scale = "share" | "dollars";

// One path shape for every bar, so a bar can grow from flat on the baseline
// by changing its numbers only.
const barPath = (left: number, top: number, barHeight: number, width: number, radius: number) =>
  `M${left},${top + barHeight}V${top + radius}q0,${-radius} ${radius},${-radius}H${left + width - radius}q${radius},0 ${radius},${radius}V${top + barHeight}Z`;

export function Bars({
  years,
  chosen,
  scale,
  onChoose,
}: {
  readonly years: ReadonlyArray<StatementYear>;
  readonly chosen: number;
  readonly scale: Scale;
  readonly onChoose: (year: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const width = Math.max(300, useWidth(box));
  const still = useStill();
  const tip = useChartTip();
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = scaleBand<number>()
    .domain(years.map((year) => year.fiscalYear))
    .range([0, innerWidth])
    .paddingInner(0.3);
  const barWidth = Math.min(30, x.bandwidth());
  const most = scale === "share" ? 1 : Math.max(...years.map((year) => revenueOf(year) ?? 0), 1);
  const y = scaleLinear().domain([0, most]).range([innerHeight, 0]).nice();
  const ticks = y.ticks(4);
  const tickText = (value: number) =>
    scale === "share" ? `${Math.round(value * 100)}%` : axisMoney(value);

  const segments = years.flatMap((year) => {
    const revenue = revenueOf(year) ?? 0;
    const byKey = new Map(yearParts(year).map((part) => [part.key, part]));
    let base = 0;
    return stackOrder.map((key) => {
      const part = byKey.get(key)!;
      const raw = part.value;
      const amount =
        raw !== null && raw > 0 && revenue > 0 ? (scale === "share" ? raw / revenue : raw) : 0;
      const segment = {
        year,
        part,
        raw,
        revenue,
        start: base,
        end: base + amount,
      };
      base += amount;
      return segment;
    });
  });

  const transition = still ? { duration: 0 } : glide;
  const centre = (year: number) => (x(year) ?? 0) + x.bandwidth() / 2;

  if (!mounted) return <div ref={box} style={{ height }} />;

  const narrow = x.step() < 36;
  const showKept = (fiscalYear: number, index: number) =>
    !narrow || fiscalYear === chosen || index === 0 || index === years.length - 1;

  return (
    <div ref={box}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`Stacked bars of where each dollar of revenue went, fiscal ${years[0]?.fiscalYear} to fiscal ${years.at(-1)?.fiscalYear}. The table view lists every figure.`}
        className="block overflow-visible"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {ticks.map((tick) => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              {tick !== 0 && <line className="grid-line" x1={0} x2={innerWidth} />}
              <text className="axis-text" x={-12} textAnchor="end" dy="0.32em">
                {tickText(tick)}
              </text>
            </g>
          ))}
          {segments.map((segment) => {
            const left = (x(segment.year.fiscalYear) ?? 0) + (x.bandwidth() - barWidth) / 2;
            const top = y(segment.end);
            const isTop = segment.part.key === "costOfRevenue";
            const barHeight = Math.max(
              0,
              y(segment.start) - top - (segment.end > segment.start && !isTop ? 2 : 0),
            );
            const d =
              barHeight <= 0
                ? barPath(left, y(segment.start), 0, barWidth, 0)
                : barPath(left, top, barHeight, barWidth, isTop ? Math.min(4, barHeight) : 0);
            const isChosen = segment.year.fiscalYear === chosen;
            return (
              <motion.path
                key={`${segment.year.fiscalYear}-${segment.part.key}`}
                initial={
                  still
                    ? false
                    : {
                        d: barPath(left, innerHeight, 0, barWidth, 0),
                        opacity: 0,
                      }
                }
                animate={{ d, opacity: isChosen ? 1 : 0.26 }}
                transition={transition}
                style={{ fill: segment.part.color, cursor: "pointer" }}
                onMouseMove={(event) =>
                  tip.show(
                    event,
                    <>
                      <strong>{segment.part.name}</strong>
                      <br />
                      Fiscal {segment.year.fiscalYear}:{" "}
                      {segment.raw === null
                        ? "gap, not reported"
                        : `${money(segment.raw)}, ${percent(segment.raw / segment.revenue)} of revenue`}
                      {segment.part.figure.kind === "calculated" && (
                        <>
                          <br />A calculated number
                        </>
                      )}
                    </>,
                  )
                }
                onMouseLeave={tip.hide}
                onClick={() => onChoose(segment.year.fiscalYear)}
              />
            );
          })}
          <line className="baseline" x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} />
          {years.map((year, index) => {
            const isChosen = year.fiscalYear === chosen;
            const kept = keptShare(year);
            return (
              <g key={year.fiscalYear}>
                <text
                  x={centre(year.fiscalYear)}
                  y={innerHeight + 26}
                  textAnchor="middle"
                  className={`cursor-pointer text-[14px] ${isChosen ? "fill-text-1 font-semibold" : "fill-text-3"}`}
                  onClick={() => onChoose(year.fiscalYear)}
                >
                  {width < 480 ? `’${String(year.fiscalYear).slice(2)}` : year.fiscalYear}
                </text>
                <text
                  x={centre(year.fiscalYear)}
                  y={innerHeight + 50}
                  textAnchor="middle"
                  className={`numbers text-[13.5px] ${isChosen ? "fill-text-1 font-semibold" : "fill-text-2"}`}
                >
                  {!showKept(year.fiscalYear, index)
                    ? ""
                    : kept === null
                      ? "gap"
                      : `${Math.round(kept * 100)}¢`}
                </text>
              </g>
            );
          })}
          <text className="axis-text" x={-12} y={innerHeight + 50} textAnchor="end">
            Kept
          </text>
        </g>
      </svg>
      {tip.element}
    </div>
  );
}
