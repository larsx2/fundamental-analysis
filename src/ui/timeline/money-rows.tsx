import { max, min } from "d3-array";
import { scaleLinear } from "d3-scale";
import { valueOf } from "../../shared/figures";
import { axisMoney, money } from "../../shared/format";
import { Term } from "../term";
import {
  colors,
  barBox,
  type Frame,
  isChosen,
  pad,
  Ticks,
  TimelineHead,
  Years,
} from "./chart-parts";

const revenueHeight = 120;
const netHeight = 72;

export function RevenueRow({
  frame,
  yearShown,
}: {
  readonly frame: Frame;
  readonly yearShown: (index: number) => boolean;
}) {
  const { spans, width: W } = frame;
  const yRevenue = scaleLinear()
    .domain([0, max(spans, (each) => valueOf(each.terms.revenue)) ?? 1])
    .nice()
    .range([revenueHeight - 2, 10]);
  return (
    <div className="tl-row">
      <TimelineHead>
        <span>
          <Term name="Revenue" />
        </span>
      </TimelineHead>
      <div className="tl-plot">
        <Ticks
          height={revenueHeight}
          ticks={yRevenue.ticks(3).map((tick) => ({ y: yRevenue(tick), text: axisMoney(tick) }))}
        />
        <svg
          width={W}
          height={revenueHeight}
          role="img"
          aria-label={`Revenue for each fiscal year from ${spans[0]!.fiscalYear} to ${spans.at(-1)!.fiscalYear}`}
        >
          {yRevenue
            .ticks(3)
            .map((tick) =>
              tick === 0 ? null : (
                <line
                  key={tick}
                  className="grid-line"
                  x1={pad.left}
                  x2={W - pad.right}
                  y1={yRevenue(tick)}
                  y2={yRevenue(tick)}
                />
              ),
            )}
          {spans.map((each) => {
            const { left, width } = barBox(frame, each);
            const revenue = valueOf(each.terms.revenue) ?? 0;
            return (
              <rect
                key={each.fiscalYear}
                data-tip={`Fiscal ${each.fiscalYear}: revenue ${money(revenue)}`}
                data-month={each.endOn.slice(0, 7)}
                x={left}
                width={width}
                y={yRevenue(revenue)}
                height={yRevenue(0) - yRevenue(revenue)}
                rx={3}
                fill={isChosen(frame, each) ? colors.barChosen : colors.bar}
              />
            );
          })}
        </svg>
      </div>
      <Years frame={frame} shown={yearShown} />
    </div>
  );
}

export function NetIncomeRow({ frame }: { readonly frame: Frame }) {
  const { spans, width: W } = frame;
  const nets = spans.map((each) => valueOf(each.terms.netIncome) ?? 0);
  const yNet = scaleLinear()
    .domain([Math.min(0, min(nets) ?? 0), Math.max(0, max(nets) ?? 1) || 1])
    .nice(2)
    .range([netHeight - 2, 10]);
  return (
    <div className="tl-row">
      <TimelineHead>
        <span>
          <Term name="Net income" />
        </span>
      </TimelineHead>
      <div className="tl-plot">
        <Ticks
          height={netHeight}
          ticks={yNet.ticks(2).map((tick) => ({ y: yNet(tick), text: axisMoney(tick) }))}
        />
        <svg
          width={W}
          height={netHeight}
          role="img"
          aria-label={`Net income for each fiscal year from ${spans[0]!.fiscalYear} to ${spans.at(-1)!.fiscalYear}`}
        >
          {yNet.ticks(2).map((tick) => (
            <line
              key={tick}
              className={tick === 0 ? "baseline" : "grid-line"}
              x1={pad.left}
              x2={W - pad.right}
              y1={yNet(tick)}
              y2={yNet(tick)}
            />
          ))}
          {spans.map((each) => {
            const { left, width } = barBox(frame, each);
            const net = valueOf(each.terms.netIncome) ?? 0;
            const top = Math.min(yNet(net), yNet(0));
            return (
              <rect
                key={each.fiscalYear}
                data-tip={`Fiscal ${each.fiscalYear}: net income ${money(net)}`}
                data-month={each.endOn.slice(0, 7)}
                x={left}
                width={width}
                y={top}
                height={Math.max(net === 0 ? 0 : 1, Math.abs(yNet(net) - yNet(0)))}
                rx={3}
                fill={isChosen(frame, each) ? colors.keptChosen : colors.kept}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
