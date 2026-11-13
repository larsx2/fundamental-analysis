import { Popover } from "@base-ui/react/popover";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { extent } from "d3-array";
import { scaleLinear } from "d3-scale";
import { line as lineShape } from "d3-shape";
import { Fragment, type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { StatementYear } from "../../functions/company";
import { type CheckedFigure, valueOf } from "../../shared/figures";
import { useChartTip } from "../../ui/chart-tip";
import {
  CompanyFrame,
  type ReadyCompany,
  searchYear,
  useReadyCompany,
} from "../../ui/company-frame";
import { useChooseYear } from "../../ui/company-header";
import {
  axisMoney,
  longDate,
  money,
  moneyShort,
  percent,
  perShare,
  signedPercent,
  signedPoints,
  yearOverYear,
} from "../../shared/format";
import { Icon } from "../../ui/icons";
import { shortName } from "../../ui/logo-tile";
import { isDoubtful } from "../../shared/figures";
import { DoubtfulMark, GapMark } from "../../ui/marks";
import { useMediaQuery, useMounted, useWidth } from "../../ui/motion";
import { type FigureKey, figureOf, formatValue, ratioKeys } from "../../shared/figure-keys";
import { FigureNotes } from "../../ui/own-figure";
import {
  labelOf,
  type Row,
  rowsOf,
  statements,
  type Tab,
  tabOrder,
  type Unit,
} from "../../ui/statements/rows";
import { Term } from "../../ui/term";

export const Route = createFileRoute("/$ticker/statements")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { year?: number | undefined; tab?: Tab | undefined } => {
    const year = searchYear(search);
    const tab = search.tab === "balance" || search.tab === "cash" ? search.tab : undefined;
    return {
      ...(year === undefined ? {} : { year }),
      ...(tab === undefined ? {} : { tab }),
    };
  },
  component: Statements,
});

const most = 4;
const extraColors = ["#b7a6f2", "#ef9c8c", "#cbc47c", "#8fcfe0"];

type CellPayload = { readonly row: Row; readonly year: StatementYear };
const figureCard = Popover.createHandle<CellPayload>();

const unitOf = (row: Row): Unit => row.unit ?? (ratioKeys.has(row.key) ? "percent" : "money");

const shortValue = (row: Row, value: number) => {
  const unit = unitOf(row);
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (unit === "perShare") return perShare(value);
  return moneyShort(value);
};

const changeText = (row: Row, now: CheckedFigure, before: CheckedFigure | undefined) => {
  const a = valueOf(now);
  const b = valueOf(before);
  if (a === null || b === null) return null;
  if (unitOf(row) === "percent") return signedPoints((a - b) * 100);
  const delta = yearOverYear(a, b);
  return delta === null ? null : signedPercent(delta);
};

function Statements() {
  const { ticker } = Route.useParams();
  const search = Route.useSearch();
  const { view, years, year } = useReadyCompany(ticker, search.year);
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: Tab = search.tab ?? "income";
  const [selected, setSelected] = useState<Record<Tab, ReadonlyArray<FigureKey>>>({
    income: statements.income.start,
    balance: statements.balance.start,
    cash: statements.cash.start,
  });
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const chooseTab = (next: Tab, focus: boolean) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        tab: next === "income" ? undefined : next,
      }),
      resetScroll: false,
    });
    if (focus) requestAnimationFrame(() => tabs.current[tabOrder.indexOf(next)]?.focus());
  };

  const onTabKey = (event: KeyboardEvent) => {
    const at = tabOrder.indexOf(tab);
    const next = {
      ArrowRight: tabOrder[(at + 1) % tabOrder.length],
      ArrowLeft: tabOrder[(at + tabOrder.length - 1) % tabOrder.length],
      Home: tabOrder[0],
      End: tabOrder[tabOrder.length - 1],
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    chooseTab(next, true);
  };

  return (
    <CompanyFrame view={view} year={year} active="statements" title="statements">
      <section className="panel panel-pad statements" aria-labelledby="statements-title">
        <h2 className="visually-hidden" id="statements-title">
          Statements
        </h2>
        <div className="mb-4 flex flex-wrap">
          <div
            className="segmented tabs"
            role="tablist"
            aria-label="Statements"
            onKeyDown={onTabKey}
          >
            {tabOrder.map((key, index) => (
              <button
                key={key}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={key === tab}
                aria-controls="sheet"
                tabIndex={key === tab ? 0 : -1}
                onClick={() => chooseTab(key, false)}
              >
                {statements[key].title}
              </button>
            ))}
          </div>
        </div>
        <Lead view={view} year={year} tab={tab} />
        <Sheet
          key={`${view.ticker}-${tab}`}
          view={view}
          years={years}
          year={year}
          tab={tab}
          selected={selected[tab]}
          setSelected={(keys) => setSelected((all) => ({ ...all, [tab]: keys }))}
        />
        <p className="mt-4 mb-0 text-xs text-text-3">
          B means billions of dollars and M millions. Tick a line to draw it across the fiscal years
          with its <Term name="Year-over-year change">year-over-year change</Term>. Choose any
          number to see the filing it came from.
        </p>
      </section>
      <FigureCard view={view} tab={tab} />
    </CompanyFrame>
  );
}

function Lead({
  view,
  year,
  tab,
}: {
  readonly view: ReadyCompany;
  readonly year: StatementYear;
  readonly tab: Tab;
}) {
  const name = shortName(view.name);
  const fy = year.fiscalYear;
  const v = (key: FigureKey) => valueOf(figureOf(year, key));
  const strong = (value: number | null) => (
    <strong>{value === null ? "a gap" : money(value)}</strong>
  );
  const used: Record<Tab, ReadonlyArray<FigureKey>> = {
    income: ["revenue", "netIncome"],
    balance: ["assets", "liabilities", "equity"],
    cash: ["operatingCashFlow", "capitalExpenditure"],
  };
  const doubtful = used[tab].some((key) => isDoubtful(figureOf(year, key)));
  let text;
  if (tab === "income" && v("revenue") !== null && v("netIncome") !== null) {
    const margin = v("netMargin");
    text = (
      <>
        The <Term name="Income statement">income statement</Term> shows that in fiscal {fy} {name}{" "}
        turned {strong(v("revenue"))} of <Term name="Revenue">revenue</Term> into{" "}
        {strong(v("netIncome"))} of <Term name="Net income">net income</Term>
        {margin === null ? (
          ""
        ) : (
          <>
            , a <Term name="Margin">margin</Term> of <strong>{percent(margin)}</strong>
          </>
        )}
        .
      </>
    );
  } else if (
    tab === "balance" &&
    v("assets") !== null &&
    v("liabilities") !== null &&
    v("equity") !== null
  ) {
    text = (
      <>
        The <Term name="Balance sheet">balance sheet</Term> shows that at the end of fiscal {fy}{" "}
        {name} owned {strong(v("assets"))} of <Term name="Asset">assets</Term> and owed{" "}
        {strong(v("liabilities"))} of <Term name="Liability">liabilities</Term>, leaving{" "}
        {strong(v("equity"))} of <Term name="Equity">equity</Term>.
      </>
    );
  } else if (
    tab === "cash" &&
    v("operatingCashFlow") !== null &&
    v("capitalExpenditure") !== null
  ) {
    text = (
      <>
        The <Term name="Cash flow statement">cash flow statement</Term> shows that in fiscal {fy}{" "}
        {name} brought in {strong(v("operatingCashFlow"))} of{" "}
        <Term name="Operating cash flow">operating cash flow</Term> and spent{" "}
        {strong(v("capitalExpenditure"))} on{" "}
        <Term name="Capital expenditure">capital expenditure</Term>, leaving{" "}
        {strong(v("freeCashFlow"))} of <Term name="Free cash flow">free cash flow</Term>.
      </>
    );
  } else {
    text = (
      <>
        The <Term name={statements[tab].title}>{statements[tab].title.toLowerCase()}</Term> of{" "}
        {name}, fiscal year by fiscal year.
      </>
    );
  }
  return (
    <p className="lead-line">
      {text}
      {doubtful && (
        <>
          {" "}
          <DoubtfulMark /> One of these is a <Term name="Doubtful number">doubtful number</Term>.
          Choose a number marked {"⚠"} in the table to see the check it failed.
        </>
      )}
    </p>
  );
}

function Sheet({
  view,
  years,
  year,
  tab,
  selected,
  setSelected,
}: {
  readonly view: ReadyCompany;
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
  readonly tab: Tab;
  readonly selected: ReadonlyArray<FigureKey>;
  readonly setSelected: (keys: ReadonlyArray<FigureKey>) => void;
}) {
  const chooseYear = useChooseYear();
  const at = years.indexOf(year);
  const start = Math.max(0, Math.min(at, years.length - 10));
  const shown = years.slice(start, start + 10);
  const newest = years.at(-1)?.fiscalYear;
  const rows = rowsOf(tab);
  const rowFor = (key: FigureKey) => rows.find((row) => row.key === key)!;
  const before = (fy: number) => years.find((each) => each.fiscalYear === fy - 1);
  const colorOf = (key: FigureKey) => {
    const row = rowFor(key);
    if (row.part !== undefined) return row.part;
    const others = selected.filter((each) => rowFor(each).part === undefined);
    return extraColors[others.indexOf(key) % extraColors.length] ?? extraColors[0]!;
  };

  const scroller = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const sheetWidth = useWidth(sheet, 1100);
  const [edges, setEdges] = useState({ left: false, right: false });
  const narrow = useMediaQuery("(max-width: 640px)");
  const label = narrow ? 132 : 264;
  const column = (sheetWidth - label) / Math.max(1, shown.length);
  const centre = (index: number) => label + (index + 0.5) * column;

  const updateEdges = () => {
    const element = scroller.current;
    if (element === null) return;
    const max = element.scrollWidth - element.clientWidth;
    const left = element.scrollLeft > 2;
    const right = element.scrollLeft < max - 2;
    setEdges((was) => (was.left === left && was.right === right ? was : { left, right }));
  };

  // The chosen fiscal year stays in view when the table is wider than the screen.
  useEffect(() => {
    const element = scroller.current;
    if (element === null) return;
    const index = shown.indexOf(year);
    const left = label + index * column;
    if (element.scrollLeft > left - label) element.scrollLeft = left - label;
    else if (element.scrollLeft + element.clientWidth < left + column)
      element.scrollLeft = left + column - element.clientWidth;
    updateEdges();
  });

  // One number at a time is reachable with Tab; the arrow keys move between numbers.
  const [active, setActive] = useState<{ key: FigureKey; fy: number } | null>(null);
  const activeKey = active ?? { key: rows[0]!.key, fy: year.fiscalYear };
  const onCellKey = (event: KeyboardEvent<HTMLTableElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      Home: [0, -99],
      End: [0, 99],
    };
    const move = moves[event.key];
    const target = event.target as HTMLElement;
    if (move === undefined || !target.classList.contains("num")) return;
    event.preventDefault();
    event.stopPropagation();
    const r = rows.findIndex((row) => row.key === target.dataset.key);
    const c = shown.findIndex((each) => each.fiscalYear === Number(target.dataset.year));
    const nr = Math.max(0, Math.min(rows.length - 1, r + move[0]));
    const nc = Math.max(0, Math.min(shown.length - 1, c + move[1]));
    const next = { key: rows[nr]!.key, fy: shown[nc]!.fiscalYear };
    setActive(next);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`.num[data-key="${next.key}"][data-year="${next.fy}"]`)
        ?.focus(),
    );
  };

  const toggle = (key: FigureKey, on: boolean) => {
    if (on && !selected.includes(key) && selected.length < most) setSelected([...selected, key]);
    if (!on) setSelected(selected.filter((each) => each !== key));
  };

  const cells = (make: (each: StatementYear, index: number) => React.ReactNode) =>
    shown.map((each, index) => (
      <td
        key={each.fiscalYear}
        className={`${each.fiscalYear === newest ? "newest" : ""} ${each.fiscalYear === year.fiscalYear ? "chosen" : ""}`}
      >
        {make(each, index)}
      </td>
    ));

  return (
    <div
      className={`sheet-wrap ${edges.left ? "can-left" : ""} ${edges.right ? "can-right" : ""}`}
      style={
        {
          "--label": `${label}px`,
          "--col": narrow ? "80px" : "88px",
        } as React.CSSProperties
      }
    >
      <button
        className="scroll-cue left"
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => scroller.current?.scrollBy({ left: -column * 3, behavior: "smooth" })}
      >
        <Icon name="left" />
      </button>
      <button
        className="scroll-cue right"
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => scroller.current?.scrollBy({ left: column * 3, behavior: "smooth" })}
      >
        <Icon name="right" />
      </button>
      <div className="sheet-scroll" ref={scroller} onScroll={updateEdges}>
        <div
          className="sheet-grid"
          ref={sheet}
          id="sheet"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
        >
          <Compare
            rows={selected.map(rowFor)}
            colorOf={colorOf}
            shown={shown}
            year={year}
            newest={newest}
            width={sheetWidth}
            label={label}
            centre={centre}
            column={column}
            before={before}
            onChoose={(fy) => void chooseYear(fy)}
          />
          <table className="statement" onKeyDown={onCellKey}>
            <caption className="visually-hidden">
              {statements[tab].title} of {shortName(view.name)}, fiscal {shown[0]?.fiscalYear} to{" "}
              {shown.at(-1)?.fiscalYear}
            </caption>
            <colgroup>
              <col className="label-col" />
              {shown.map((each) => (
                <col key={each.fiscalYear} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Line</span>
                </th>
                {shown.map((each) => (
                  <th
                    key={each.fiscalYear}
                    scope="col"
                    className={`${each.fiscalYear === newest ? "newest" : ""} ${each.fiscalYear === year.fiscalYear ? "chosen" : ""}`}
                  >
                    <button
                      type="button"
                      className="year-head"
                      tabIndex={-1}
                      aria-current={each.fiscalYear === year.fiscalYear}
                      onClick={() => void chooseYear(each.fiscalYear)}
                    >
                      <span className="newest-tag">
                        {each.fiscalYear === newest ? "Newest" : ""}
                      </span>
                      <span className="y">{each.fiscalYear}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            {statements[tab].groups.map((group, groupIndex) => (
              <tbody key={group.head ?? groupIndex}>
                {group.head !== undefined ? (
                  <tr className="group-head">
                    <th scope="rowgroup">{group.head}</th>
                    {cells(() => null)}
                  </tr>
                ) : groupIndex > 0 ? (
                  <tr className="spacer">
                    <th />
                    {cells(() => null)}
                  </tr>
                ) : null}
                {group.rows.map((row) => {
                  const figures = shown.map((each) => figureOf(each, row.key));
                  const present = figures.filter((figure) => figure.kind !== "gap");
                  const allCalculated =
                    present.length > 0 && present.every((figure) => figure.kind === "calculated");
                  const on = selected.includes(row.key);
                  return (
                    <Fragment key={row.key}>
                      <tr className={`line ${row.kind ?? "plain"}`}>
                        <th scope="row">
                          <span className="line-label">
                            <input
                              type="checkbox"
                              className="pick"
                              aria-label={`Draw ${labelOf(row).toLowerCase()} across the fiscal years`}
                              checked={on}
                              disabled={!on && selected.length >= most}
                              style={
                                on
                                  ? ({
                                      "--line": colorOf(row.key),
                                    } as React.CSSProperties)
                                  : undefined
                              }
                              onChange={(event) => toggle(row.key, event.target.checked)}
                            />
                            <span className="name">
                              {row.after === undefined ? (
                                <Term name={row.term}>{labelOf(row)}</Term>
                              ) : (
                                <>
                                  <Term name={row.term} /> {row.after}
                                </>
                              )}
                              {allCalculated && (
                                <>
                                  {" "}
                                  <span className="mark">calculated</span>
                                </>
                              )}
                            </span>
                          </span>
                        </th>
                        {cells((each) => {
                          const figure = figureOf(each, row.key);
                          const isActive =
                            activeKey.key === row.key && activeKey.fy === each.fiscalYear;
                          const grey =
                            figure.kind === "calculated" && !allCalculated && row.kind !== "calc";
                          return (
                            <Popover.Trigger
                              handle={figureCard}
                              payload={{ row, year: each }}
                              className="num"
                              tabIndex={isActive ? 0 : -1}
                              data-key={row.key}
                              data-year={each.fiscalYear}
                              aria-label={`${labelOf(row)}, fiscal ${each.fiscalYear}: ${figure.kind === "gap" ? "gap" : formatValue(row.key, figure.value)}${figure.kind === "calculated" ? ", calculated" : ""}${isDoubtful(figure) ? ", doubtful" : ""}`}
                              onFocus={() => setActive({ key: row.key, fy: each.fiscalYear })}
                            >
                              {figure.kind === "gap" ? (
                                <GapMark />
                              ) : (
                                <>
                                  {isDoubtful(figure) && (
                                    <span className="warn" aria-hidden="true">
                                      {"⚠"}
                                    </span>
                                  )}
                                  <span className={grey ? "calc-cell" : undefined}>
                                    {shortValue(row, figure.value)}
                                  </span>
                                </>
                              )}
                            </Popover.Trigger>
                          );
                        })}
                      </tr>
                      {on && (
                        <tr className="change-row">
                          <th scope="row">
                            <span className="change-label">
                              <Term name="Year-over-year change" />
                            </span>
                          </th>
                          {cells((each, index) => {
                            const previous = before(each.fiscalYear);
                            const text =
                              index === 0 || previous === undefined
                                ? null
                                : changeText(
                                    row,
                                    figureOf(each, row.key),
                                    figureOf(previous, row.key),
                                  );
                            return text === null ? null : <span className="between">{text}</span>;
                          })}
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </div>
  );
}

const unitOrder: ReadonlyArray<Unit> = ["money", "percent", "perShare"];

function Compare({
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

// Where a number came from: the period it covers, the filing, and its marks.
function FigureCard({ view, tab }: { readonly view: ReadyCompany; readonly tab: Tab }) {
  const name = shortName(view.name);
  return (
    <Popover.Root handle={figureCard}>
      {({ payload }) => {
        if (payload === undefined) return null;
        const { row, year } = payload;
        const figure = figureOf(year, row.key);
        const revenue = valueOf(year.terms.revenue);
        const when = statements[tab].instant
          ? `On ${longDate(year.endOn)}, the last day of fiscal ${year.fiscalYear}.`
          : `Over fiscal ${year.fiscalYear}, from ${longDate(year.startOn)} to ${longDate(year.endOn)}.`;
        return (
          <Popover.Portal>
            <Popover.Positioner
              side="bottom"
              align="end"
              sideOffset={8}
              collisionPadding={16}
              className="z-50"
            >
              <Popover.Popup className="card figure-card">
                <Popover.Close className="close" aria-label="Close">
                  <Icon name="close" className="h-4 w-4" />
                </Popover.Close>
                <p className="eyebrow">
                  {name} in fiscal {year.fiscalYear}
                </p>
                <Popover.Title render={<h3 />}>
                  <Term name={row.term}>{labelOf(row)}</Term>
                </Popover.Title>
                {figure.kind === "gap" ? (
                  <>
                    <div className="figure-line">
                      <GapMark />
                    </div>
                    <p className="note">
                      {name}'s annual report for fiscal {year.fiscalYear} has no figure for{" "}
                      {labelOf(row).toLowerCase()} that the tool can read. It is not zero.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="figure-line">
                      <span className="numbers">{formatValue(row.key, figure.value)}</span>
                      {tab === "income" &&
                      row.unit === undefined &&
                      !ratioKeys.has(row.key) &&
                      row.key !== "revenue" &&
                      revenue !== null &&
                      revenue !== 0
                        ? `, ${percent(figure.value / revenue)} of revenue`
                        : ""}
                    </div>
                    <p className="note">{when}</p>
                    <FigureNotes
                      figure={figure}
                      figureKey={row.key}
                      cik={view.cik}
                      companyName={name}
                      termName={labelOf(row)}
                    />
                  </>
                )}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        );
      }}
    </Popover.Root>
  );
}
