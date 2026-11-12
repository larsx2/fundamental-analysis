import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StatementYear } from "../../functions/company";
import { findTerm } from "../../glossary/glossary";
import { useChartTip } from "../chart-tip";
import { Icon } from "../icons";
import { useMediaQuery, useStill } from "../motion";
import { Term } from "../term";
import { createFlow, type Flow, type FlowSpec, type FlowValues } from "./flow-engine";
import { amountOf, cents, type Lens, layouts, links, nameOf, partsOf, valuesOf } from "./flows";
import { formatValue, readPart } from "./read-part";

const lenses: ReadonlyArray<Lens> = ["profit", "cash"];
const home: Record<Lens, string> = { profit: "net", cash: "capex" };

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const empty = (lens: Lens): FlowValues =>
  Object.fromEntries(partsOf(lens).map((part) => [part.id, 0]));

export function MoneyExplorer({
  lens,
  compare,
  years,
  year,
  company,
  onYear,
}: {
  readonly lens: Lens;
  readonly compare: boolean;
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
  readonly company: string;
  readonly onYear: (fiscalYear: number) => void;
}) {
  const still = useStill();
  const canHover = useMediaQuery("(hover: hover)");
  const tip = useChartTip();
  const [zoom, setZoom] = useState(0);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<Lens, string>>(home);
  const hosts = {
    profit: useRef<HTMLDivElement>(null),
    cash: useRef<HTMLDivElement>(null),
  };
  const flows = useRef<Partial<Record<Lens, Flow>>>({});
  const swept = useRef(new Set<Lens>());
  const closeButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const index = years.findIndex((each) => each.fiscalYear === year.fiscalYear);
  const previous = index > 0 ? years[index - 1] : undefined;
  const current = useMemo(
    () => ({ profit: valuesOf("profit", year), cash: valuesOf("cash", year) }),
    [year],
  );
  const compareWith = useRef<Record<Lens, FlowValues | null>>({
    profit: null,
    cash: null,
  });
  compareWith.current = compare
    ? {
        profit: previous === undefined ? null : valuesOf("profit", previous),
        cash: previous === undefined ? null : valuesOf("cash", previous),
      }
    : { profit: null, cash: null };

  const pick = useRef((_id: string | null) => {});
  pick.current = (id) => {
    if (id === null) {
      setOpen(false);
      return;
    }
    if (lens === "profit" && id === "gross" && zoom === 0) setZoom(1);
    if (!drawer.current?.contains(document.activeElement)) {
      opener.current = document.activeElement as HTMLElement | null;
    }
    setPicked((was) => ({ ...was, [lens]: id }));
    setOpen(true);
  };

  useEffect(() => {
    for (const each of lenses) {
      const host = hosts[each].current;
      if (host === null) continue;
      const spec: FlowSpec = {
        nodes: partsOf(each),
        links: links[each],
        layouts: layouts[each],
        label: (id, values) => {
          const { main, sub } = amountOf(each, id, values);
          const before = compareWith.current[each];
          return `<span class="flow-label-name">${escape(nameOf(each, id, values))}</span><span class="flow-label-value">${main}${sub === "" ? "" : `<span>${sub}</span>`}${before === null ? "" : delta(each, id, values, before)}</span>`;
        },
        tip: (id, values, link) => {
          const key = link === null ? id : `${link.source}>${link.target}`;
          const amount = values[key] ?? values[id] ?? 0;
          const name = nameOf(each, id, values);
          if (each === "cash") return { title: name, line: amountOf(each, id, values).main };
          const dollars = ((id === "revenue" ? 100 : amount) / 100) * (values.revenueDollars ?? 0);
          return {
            title: name,
            line: `${amountOf("cash", "x", { x: dollars }).main}, ${cents(id === "revenue" ? 100 : amount)} of each dollar`,
          };
        },
        describe: (values) =>
          partsOf(each)
            .filter((part) => (values[part.id] ?? 0) > 0)
            .map(
              (part) => `${nameOf(each, part.id, values)} ${amountOf(each, part.id, values).main}`,
            )
            .join(", "),
      };
      flows.current[each] = createFlow(
        host,
        spec,
        current[each] ?? empty(each),
        {
          onPick: (id) => pick.current(id),
          onTip: (event, content) =>
            event === null || content === null
              ? tip.hide()
              : tip.show(
                  event,
                  <>
                    <strong>{content.title}</strong>
                    <br />
                    {content.line}
                  </>,
                ),
        },
        { still, canHover },
      );
    }
    return () => {
      for (const each of lenses) flows.current[each]?.destroy();
      flows.current = {};
      swept.current.clear();
    };
  }, [still, canHover]);

  useEffect(() => {
    for (const each of lenses) flows.current[each]?.setValues(current[each] ?? empty(each));
  }, [current]);

  useEffect(() => {
    const flow = flows.current[lens];
    if (flow === undefined || swept.current.has(lens)) return;
    swept.current.add(lens);
    flow.sweep();
  }, [lens, still, canHover]);

  useEffect(() => {
    flows.current.profit?.zoomTo(zoom);
  }, [zoom]);

  useEffect(() => {
    for (const each of lenses) flows.current[each]?.redraw();
  }, [compare]);

  useEffect(() => {
    for (const each of lenses) {
      const id = picked[each];
      flows.current[each]?.focus(open && each === lens && id !== "gross" ? id : null);
    }
  }, [open, picked, lens]);

  useEffect(() => {
    if (lens === "cash") setOpen(false);
  }, [lens]);

  useLayoutEffect(() => {
    if (open && opener.current?.classList.contains("flow-label")) {
      closeButton.current?.focus({ preventScroll: true });
    }
    if (!open && drawer.current?.contains(document.activeElement)) {
      opener.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable], [role=dialog]") !== null
      ) {
        return;
      }
      if (event.key === "Escape") {
        if (open) setOpen(false);
        else setZoom(0);
      } else if (lens === "profit" && (event.key === "+" || event.key === "=")) {
        setZoom(1);
      } else if (lens === "profit" && event.key === "-") {
        setZoom(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lens]);

  const values = current.profit;
  const gross = values?.gross ?? 0;
  const reading = open ? readPart(lens, picked[lens], years, year.fiscalYear) : null;
  const noCash = lens === "cash" && current.cash === null;

  return (
    <div className={`flow-explorer${open ? " is-open" : ""}`}>
      <div className="flow-stage">
        <div className={`flow-crumbs${zoom === 1 ? " is-zoomed" : ""}`} hidden={lens !== "profit"}>
          <button type="button" aria-current={zoom === 0} onClick={() => setZoom(0)}>
            Each dollar of revenue
          </button>
          <span className="flow-crumb-step" aria-hidden="true">
            ›
          </span>
          <button
            type="button"
            className="flow-crumb-deep"
            aria-current={zoom === 1}
            tabIndex={zoom === 1 ? 0 : -1}
          >
            Gross profit
          </button>
          <span className="flow-scale" aria-hidden={zoom === 0}>
            <span className="flow-scale-bar">
              <i style={{ width: `${gross}%` }} />
            </span>
            <span>
              <b>{cents(gross)}</b> of each dollar, drawn{" "}
              {gross > 0 ? (100 / gross).toFixed(1) : "0"} times larger
            </span>
          </span>
          <div className="flow-zoom" role="group" aria-label="Zoom">
            <button
              type="button"
              aria-label="Zoom out to each dollar of revenue"
              data-tip="Each dollar  −"
              disabled={zoom === 0}
              onClick={() => setZoom(0)}
            >
              <Icon name="zoomOut" />
            </button>
            <button
              type="button"
              aria-label="Zoom in to gross profit"
              data-tip="Zoom in  +"
              disabled={zoom === 1}
              onClick={() => setZoom(1)}
            >
              <Icon name="zoomIn" />
            </button>
          </div>
        </div>
        <div className="flow-views">
          {lenses.map((each) => (
            <div
              key={each}
              className="flow-view"
              data-off={each === lens ? undefined : ""}
              inert={each !== lens}
            >
              <div ref={hosts[each]} id={`flow-${each}`} className="flow-host" />
            </div>
          ))}
          {noCash && (
            <p className="flow-missing">
              {company} reports no operating cash flow for fiscal {year.fiscalYear}, so there is no
              cash to follow this year.
            </p>
          )}
        </div>
      </div>
      <aside
        ref={drawer}
        className="flow-drawer"
        aria-label="About the part you picked"
        inert={!open}
      >
        <div className="flow-drawer-inner">
          <button
            ref={closeButton}
            type="button"
            className="flow-close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
          </button>
          {reading !== null && (
            <PartDrawer key={`${lens}-${picked[lens]}`} reading={reading} onYear={onYear} />
          )}
        </div>
      </aside>
      {tip.element}
    </div>
  );
}

function delta(lens: Lens, id: string, values: FlowValues, before: FlowValues) {
  if (lens === "profit" && id === "revenue") return "";
  const part = partsOf(lens).find((each) => each.id === id);
  const now = values[`signed:${id}`] ?? values[id] ?? 0;
  const was = before[`signed:${id}`] ?? before[id] ?? 0;
  const change = lens === "profit" ? now - was : was === 0 ? null : (now / was - 1) * 100;
  if (change === null) return "";
  const good = part?.lowerIsBetter === true ? change < 0 : change > 0;
  const size = Math.abs(change);
  const text =
    lens === "profit"
      ? `${change >= 0 ? "+" : "−"}${size.toFixed(2)}¢`
      : `${change >= 0 ? "+" : "−"}${size.toFixed(0)}%`;
  if (size < 0.005) return `<small class="flow-delta">${text}</small>`;
  return `<small class="flow-delta ${good ? "better" : "worse"}">${text}<span class="visually-hidden">, ${good ? "better" : "worse"}</span></small>`;
}

function PartDrawer({
  reading,
  onYear,
}: {
  readonly reading: NonNullable<ReturnType<typeof readPart>>;
  readonly onYear: (fiscalYear: number) => void;
}) {
  const { series, current, average, unit } = reading;
  const values = series.map((each) => each.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = (high - low || Math.abs(high) * 0.1 || 1) * 0.18;
  const bottom = low - pad;
  const top = high + pad;
  const width = 252;
  const height = 110;
  const gutter = 44;
  const first = series[0]!.fiscalYear;
  const last = series.at(-1)!.fiscalYear;
  const x = (fiscalYear: number) =>
    gutter + (last === first ? 0.5 : (fiscalYear - first) / (last - first)) * (width - gutter);
  const y = (value: number) => height - ((value - bottom) / (top - bottom)) * height;
  const line = series
    .map(
      (each, i) =>
        `${i === 0 ? "M" : "L"}${x(each.fiscalYear).toFixed(1)},${y(each.value).toFixed(1)}`,
    )
    .join("");
  const format = (value: number) => formatValue(unit, value);
  const entry = findTerm(reading.term);
  const scaleLabel = (value: number, text: string) => (
    <text className="flow-axis" x={gutter - 8} y={y(value) + 4} textAnchor="end">
      {text}
    </text>
  );
  const avgFar = Math.abs(y(average) - y(high)) > 14 && Math.abs(y(average) - y(low)) > 14;
  const nearEnd = current - first < 2 || last - current < 2;

  return (
    <div className="flow-drawer-body" style={{ "--part": reading.color } as React.CSSProperties}>
      <h3>
        <i aria-hidden="true" />
        {reading.name}
      </h3>
      <div>
        <div className="flow-drawer-big numbers">{reading.big}</div>
        <div className="flow-drawer-sub numbers">{reading.sub}</div>
      </div>
      <p className="flow-drawer-verdict">
        {reading.verdict.before}
        {reading.verdict.strong !== undefined && (
          <b className={reading.verdict.strong.tone}>{reading.verdict.strong.text}</b>
        )}
        {reading.verdict.after}
      </p>
      {reading.stats.length > 0 && (
        <dl className="flow-drawer-stats">
          {reading.stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd className={`numbers ${stat.tone}`}>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flow-trend">
        <svg
          viewBox={`0 -14 ${width + 6} ${height + 36}`}
          role="group"
          aria-label={`${reading.name}, fiscal ${first} to ${last}`}
        >
          <line className="flow-grid" x1={gutter} x2={width} y1={y(high)} y2={y(high)} />
          <line className="flow-grid" x1={gutter} x2={width} y1={y(low)} y2={y(low)} />
          <line className="flow-average" x1={gutter} x2={width} y1={y(average)} y2={y(average)} />
          {scaleLabel(high, format(high))}
          {scaleLabel(low, format(low))}
          {avgFar && scaleLabel(average, "avg")}
          <path className="flow-trend-line" d={line} stroke={reading.color} pathLength={1} />
          {series.map((each) => {
            const chosen = each.fiscalYear === current;
            const choose = () => onYear(each.fiscalYear);
            return (
              <g
                key={each.fiscalYear}
                className="flow-point"
                role="button"
                tabIndex={0}
                aria-label={`Show fiscal ${each.fiscalYear}: ${format(each.value)}`}
                onClick={choose}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    choose();
                  }
                }}
              >
                <rect
                  x={x(each.fiscalYear) - 10}
                  y={-14}
                  width={20}
                  height={height + 16}
                  fill="transparent"
                />
                <circle
                  cx={x(each.fiscalYear)}
                  cy={y(each.value)}
                  r={chosen ? 4.5 : 2.5}
                  fill={chosen ? "var(--color-text-1)" : reading.color}
                  stroke="var(--color-surface-1)"
                  strokeWidth={chosen ? 2.5 : 0}
                />
              </g>
            );
          })}
          <text className="flow-axis" x={x(first)} y={height + 18} textAnchor="middle">
            {first}
          </text>
          {!nearEnd && (
            <text className="flow-axis is-now" x={x(current)} y={height + 18} textAnchor="middle">
              {current}
            </text>
          )}
          <text className="flow-axis" x={x(last)} y={height + 18} textAnchor="middle">
            {last}
          </text>
        </svg>
        <p className="flow-trend-hint">
          The dashed line is the {series.length}-year average. Pick a year to see it in the flow.
        </p>
      </div>
      <p className="flow-drawer-about">
        <Term name={reading.term}>What this is.</Term> {reading.about ?? entry?.definition ?? ""}
      </p>
    </div>
  );
}
