import { scaleUtc } from "d3-scale";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { monthName, rate } from "../../shared/format";
import { useChartTip } from "../chart-tip";
import type { ReadyCompany } from "../company-frame";
import { useMounted, useWidth } from "../motion";
import { type Frame, pad } from "./chart-parts";
import { AllocationRow } from "./allocation-row";
import { EconomyRow } from "./economy-row";
import { EventsRow } from "./events-row";
import { Backdrop, Cursor, MonthAxis } from "./layers";
import { NetIncomeRow, RevenueRow } from "./money-rows";
import {
  type EconomyMonth,
  fiscalOf,
  inflationText,
  middle,
  nearestMonth,
  type Span,
  yearLabelShown,
} from "./time";

export function Rows({
  view,
  spans,
  span,
  months,
  month,
  choose,
  economyState,
}: {
  readonly view: ReadyCompany;
  readonly spans: ReadonlyArray<Span>;
  readonly span: Span;
  readonly months: ReadonlyArray<EconomyMonth>;
  readonly month: string;
  readonly choose: (month: string) => void;
  readonly economyState: "loading" | "failed" | "ready";
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const tip = useChartTip();
  const available = useWidth(scroller, 900);
  const W = Math.max(available, 620, spans.length * 28 + pad.left + pad.right);
  const economyRow = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [economyTop, setEconomyTop] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const x = scaleUtc()
    .domain([spans[0]!.start, spans.at(-1)!.end])
    .range([pad.left, W - pad.right]);
  const cursorX = x(middle(month));

  useLayoutEffect(() => {
    const element = rows.current;
    if (element === null) return;
    const measure = () => {
      setHeight(element.offsetHeight);
      setEconomyTop(economyRow.current?.offsetTop ?? 0);
    };
    measure();
    // Drawn again before the next paint, so the shading never lags the rows.
    const observer = new ResizeObserver(() => flushSync(measure));
    observer.observe(element);
    return () => observer.disconnect();
  }, [mounted]);

  const updateEdges = () => {
    const element = scroller.current;
    if (element === null) return;
    const maxScroll = element.scrollWidth - element.clientWidth;
    const left = element.scrollLeft > 2;
    const right = element.scrollLeft < maxScroll - 2;
    setEdges((was) => (was.left === left && was.right === right ? was : { left, right }));
  };

  // The box opens at the chosen month, and follows it when it moves out of view.
  useEffect(() => {
    const element = scroller.current;
    if (element === null) return;
    const visible = cursorX - element.scrollLeft;
    if (visible < 60 || visible > element.clientWidth - 60)
      element.scrollLeft = cursorX - element.clientWidth / 2;
    updateEdges();
  }, [cursorX, mounted]);

  if (!mounted) return <div ref={scroller} className="tl-scroll" style={{ height: 900 }} />;

  const frame: Frame = { spans, span, width: W, x };
  const monthAt = (px: number) => nearestMonth(months, x.invert(px));
  const pointX = (event: React.PointerEvent | React.MouseEvent) =>
    event.clientX - (rows.current?.getBoundingClientRect().left ?? 0);
  const yearShown = yearLabelShown(
    x(spans[0]!.end) - x(spans[0]!.start) < 40,
    spans.indexOf(span),
    spans.length - 1,
  );

  return (
    <div className={`tl-wrap ${edges.left ? "can-left" : ""} ${edges.right ? "can-right" : ""}`}>
      <div className="tl-scroll" ref={scroller} onScroll={updateEdges}>
        <div
          className="tl-rows"
          ref={rows}
          style={{ width: W }}
          onPointerMove={(event) => {
            const px = pointX(event);
            if (px < x.range()[0]! || px > x.range()[1]!) {
              setHover(null);
              tip.hide();
              return;
            }
            const found = monthAt(px);
            setHover(found === null ? null : x(middle(found)));
            const mark = (event.target as Element).closest("[data-tip]");
            const data = months.find((each) => each.month === found);
            if (mark !== null) tip.show(event, <span>{mark.getAttribute("data-tip")}</span>);
            else if (data !== undefined) {
              tip.show(
                event,
                <>
                  <strong>{monthName(data.month)}</strong>
                  <br />
                  Fiscal {fiscalOf(spans, middle(data.month))?.fiscalYear}
                  <br />
                  Interest rate {data.interestRate === null ? "gap" : rate(data.interestRate)}
                  <br />
                  Inflation {inflationText(data.inflation)}
                  {data.recession && (
                    <>
                      <br />
                      Recession
                    </>
                  )}
                </>,
              );
            } else tip.hide();
          }}
          onPointerLeave={() => {
            setHover(null);
            tip.hide();
          }}
          onClick={(event) => {
            if ((event.target as Element).closest("button, a")) return;
            const marked = (event.target as Element).closest("[data-month]");
            if (marked !== null) return choose(marked.getAttribute("data-month")!);
            const px = pointX(event);
            if (px < x.range()[0]! - 8 || px > x.range()[1]! + 8) return;
            const found = monthAt(px);
            if (found !== null) choose(found);
            else {
              const owner = fiscalOf(spans, x.invert(px));
              if (owner !== undefined) choose(owner.endOn.slice(0, 7));
            }
          }}
        >
          <Backdrop frame={frame} months={months} height={height} />
          <RevenueRow frame={frame} yearShown={yearShown} />
          <NetIncomeRow frame={frame} />
          <AllocationRow frame={frame} />
          <EventsRow
            frame={frame}
            events={view.details.events}
            eventsFrom={view.details.eventsFrom}
          />
          <EconomyRow
            ref={economyRow}
            frame={frame}
            months={months}
            month={month}
            cursorX={cursorX}
            economyState={economyState}
          />
          <MonthAxis
            frame={frame}
            months={months}
            month={month}
            cursorX={cursorX}
            yearShown={yearShown}
            choose={choose}
          />
          <Cursor width={W} height={height} top={economyTop} cursorX={cursorX} hover={hover} />
        </div>
      </div>
      {tip.element}
    </div>
  );
}
