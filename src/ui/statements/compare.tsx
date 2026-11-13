import { extent } from "d3-array";
import { scaleLinear } from "d3-scale";
import { line as lineShape } from "d3-shape";
import type { StatementYear } from "../../functions/company";
import { type FigureKey, figureOf, formatValue } from "../../shared/figure-keys";
import { valueOf } from "../../shared/figures";
import { axisMoney } from "../../shared/format";
import { useChartTip } from "../chart-tip";
import { GapMark } from "../marks";
import { useMounted } from "../motion";
import { changeText, most, shortValue, unitOf } from "./cells";
import { labelOf, type Row, type Unit } from "./rows";

const unitOrder: ReadonlyArray<Unit> = ["money", "percent", "perShare"];

export function Compare({
  rows,
  colorOf,
  shown,
  year,
  newest,
  width,
  label,
  centre,
  column,
  before,
  onChoose,
}: {
  readonly rows: ReadonlyArray<Row>;
  readonly colorOf: (key: FigureKey) => string;
  readonly shown: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
  readonly newest: number | undefined;
  readonly width: number;
  readonly label: number;
  readonly centre: (index: number) => number;
  readonly column: number;
  readonly before: (fy: number) => StatementYear | undefined;
  readonly onChoose: (fy: number) => void;
}) {
  const mounted = useMounted();
  const tip = useChartTip();
  const narrow = label < 200;
  const units = unitOrder.filter((unit) => rows.some((row) => unitOf(row) === unit));
  const bandHeight = narrow ? 150 : 190;
  const bandGap = 28;
  const top = 14;
  const drawn =
    units.length > 0 ? top + units.length * bandHeight + (units.length - 1) * bandGap + 8 : 96;
  const chosenIndex = shown.indexOf(year);
  const newestIndex = shown.findIndex((each) => each.fiscalYear === newest);
  const tickText = (unit: Unit, value: number) =>
    unit === "percent"
      ? `${Math.round(value * 100)}%`
      : unit === "perShare"
        ? `$${value}`
        : axisMoney(value);

  return (
    <div className="compare" style={{ height: drawn }}>
      <div className="compare-key">
        {rows.length > 0 ? (
          <>
            <div className="key-year">Fiscal {year.fiscalYear}</div>
            <ul>
              {rows.map((row) => {
                const value = valueOf(figureOf(year, row.key));
                return (
                  <li key={row.key}>
                    <i style={{ background: colorOf(row.key) }} />
                    <span>{labelOf(row)}</span>
                    <span className="key-value numbers">
                      {value === null ? <GapMark /> : shortValue(row, value)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {rows.length >= most && <p className="key-note">Four lines at most.</p>}
          </>
        ) : (
          <p className="key-empty">Tick a line to draw it across the fiscal years.</p>
        )}
      </div>
      {mounted && (
        <svg
          width={width}
          height={drawn}
          viewBox={`0 0 ${width} ${drawn}`}
          role="img"
          aria-label={
            rows.length > 0
              ? `${rows.map(labelOf).join(", ")} across fiscal ${shown[0]?.fiscalYear} to ${shown.at(-1)?.fiscalYear}`
              : "No lines drawn"
          }
          onMouseLeave={tip.hide}
        >
          {newestIndex >= 0 && (
            <rect
              x={label + newestIndex * column}
              y={0}
              width={column}
              height={drawn}
              fill="rgb(244 244 242 / 0.045)"
            />
          )}
          {chosenIndex >= 0 && rows.length > 0 && (
            <line
              className="chosen-line"
              x1={centre(chosenIndex)}
              x2={centre(chosenIndex)}
              y1={0}
              y2={drawn - 4}
            />
          )}
          {units.map((unit, bandIndex) => {
            const y0 = top + bandIndex * (bandHeight + bandGap);
            const inBand = rows.filter((row) => unitOf(row) === unit);
            const values = inBand
              .flatMap((row) => shown.map((each) => valueOf(figureOf(each, row.key))))
              .filter((value): value is number => value !== null);
            const [low = 0, high = 1] = extent(values);
            const y = scaleLinear()
              .domain([Math.min(0, low), Math.max(0, high === low ? low + 1 : high)])
              .range([y0 + bandHeight, y0])
              .nice(4);
            return (
              <g key={unit}>
                {y.ticks(3).map((tick) => (
                  <g key={tick}>
                    <line
                      className={tick === 0 ? "zero-line" : "grid-line"}
                      x1={label}
                      x2={width}
                      y1={y(tick)}
                      y2={y(tick)}
                    />
                    <text className="tick-text" x={label + 6} y={y(tick) - 5}>
                      {tickText(unit, tick)}
                    </text>
                  </g>
                ))}
                {inBand.map((row) => {
                  const points = shown.map((each, index) => ({
                    each,
                    index,
                    value: valueOf(figureOf(each, row.key)),
                  }));
                  const path = lineShape<(typeof points)[number]>()
                    .defined((point) => point.value !== null)
                    .x((point) => centre(point.index))
                    .y((point) => y(point.value ?? 0))(points);
                  return (
                    <g key={row.key}>
                      <path
                        className="series"
                        d={path ?? ""}
                        style={{ stroke: colorOf(row.key) }}
                      />
                      {points.map((point) =>
                        point.value === null ? null : (
                          <circle
                            key={point.each.fiscalYear}
                            className="dot"
                            cx={centre(point.index)}
                            cy={y(point.value)}
                            r={point.each === year ? 5 : 3.5}
                            style={{ fill: colorOf(row.key) }}
                            onClick={() => onChoose(point.each.fiscalYear)}
                            onMouseMove={(event) => {
                              const previous = before(point.each.fiscalYear);
                              const change = changeText(
                                row,
                                figureOf(point.each, row.key),
                                previous === undefined ? undefined : figureOf(previous, row.key),
                              );
                              tip.show(
                                event,
                                <>
                                  <strong>{labelOf(row)}</strong>
                                  <br />
                                  Fiscal {point.each.fiscalYear}:{" "}
                                  {formatValue(row.key, point.value!)}
                                  {change !== null && (
                                    <>
                                      <br />
                                      Year-over-year change: {change}
                                    </>
                                  )}
                                </>,
                              );
                            }}
                          />
                        ),
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}
      {tip.element}
    </div>
  );
}
