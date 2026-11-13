import { Popover } from "@base-ui/react/popover";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import type { StatementYear } from "../../functions/company";
import { type FigureKey, figureOf, formatValue } from "../../shared/figure-keys";
import { isDoubtful } from "../../shared/figures";
import type { ReadyCompany } from "../company-frame";
import { useChooseYear } from "../company-header";
import { Icon } from "../icons";
import { shortName } from "../logo-tile";
import { GapMark } from "../marks";
import { useMediaQuery, useWidth } from "../motion";
import { Term } from "../term";
import { type Cell, changeText, moveCell, most, shortValue, yearWindow } from "./cells";
import { Compare } from "./compare";
import { figureCard } from "./figure-card";
import { labelOf, type Row, rowsOf, statements, type Tab } from "./rows";

const extraColors = ["#b7a6f2", "#ef9c8c", "#cbc47c", "#8fcfe0"];

type Cells = (make: (each: StatementYear, index: number) => ReactNode) => ReactNode;

export function Sheet({
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
  const shown = yearWindow(years, year);
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
  const [active, setActive] = useState<Cell | null>(null);
  const activeKey = active ?? { key: rows[0]!.key, fy: year.fiscalYear };
  const onCellKey = (event: KeyboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains("num")) return;
    const next = moveCell(
      rows,
      shown,
      { key: target.dataset.key, fy: Number(target.dataset.year) },
      event.key,
    );
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
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

  const cells: Cells = (make) =>
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
                {group.rows.map((row) => (
                  <SheetLine
                    key={row.key}
                    row={row}
                    shown={shown}
                    on={selected.includes(row.key)}
                    full={selected.length >= most}
                    colorOf={colorOf}
                    active={activeKey}
                    onActive={setActive}
                    onToggle={(on) => toggle(row.key, on)}
                    before={before}
                    cells={cells}
                  />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </div>
  );
}

function SheetLine({
  row,
  shown,
  on,
  full,
  colorOf,
  active,
  onActive,
  onToggle,
  before,
  cells,
}: {
  readonly row: Row;
  readonly shown: ReadonlyArray<StatementYear>;
  readonly on: boolean;
  readonly full: boolean;
  readonly colorOf: (key: FigureKey) => string;
  readonly active: Cell;
  readonly onActive: (cell: Cell) => void;
  readonly onToggle: (on: boolean) => void;
  readonly before: (fy: number) => StatementYear | undefined;
  readonly cells: Cells;
}) {
  const figures = shown.map((each) => figureOf(each, row.key));
  const present = figures.filter((figure) => figure.kind !== "gap");
  const allCalculated =
    present.length > 0 && present.every((figure) => figure.kind === "calculated");
  return (
    <>
      <tr className={`line ${row.kind ?? "plain"}`}>
        <th scope="row">
          <span className="line-label">
            <input
              type="checkbox"
              className="pick"
              aria-label={`Draw ${labelOf(row).toLowerCase()} across the fiscal years`}
              checked={on}
              disabled={!on && full}
              style={
                on
                  ? ({
                      "--line": colorOf(row.key),
                    } as React.CSSProperties)
                  : undefined
              }
              onChange={(event) => onToggle(event.target.checked)}
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
          const isActive = active.key === row.key && active.fy === each.fiscalYear;
          const grey = figure.kind === "calculated" && !allCalculated && row.kind !== "calc";
          return (
            <Popover.Trigger
              handle={figureCard}
              payload={{ row, year: each }}
              className="num"
              tabIndex={isActive ? 0 : -1}
              data-key={row.key}
              data-year={each.fiscalYear}
              aria-label={`${labelOf(row)}, fiscal ${each.fiscalYear}: ${figure.kind === "gap" ? "gap" : formatValue(row.key, figure.value)}${figure.kind === "calculated" ? ", calculated" : ""}${isDoubtful(figure) ? ", doubtful" : ""}`}
              onFocus={() => onActive({ key: row.key, fy: each.fiscalYear })}
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
                : changeText(row, figureOf(each, row.key), figureOf(previous, row.key));
            return text === null ? null : <span className="between">{text}</span>;
          })}
        </tr>
      )}
    </>
  );
}
