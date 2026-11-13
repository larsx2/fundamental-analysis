import { max } from "d3-array";
import { scaleLinear } from "d3-scale";
import { figureOf } from "../../shared/figure-keys";
import { valueOf } from "../../shared/figures";
import { axisMoney, capitalise, money } from "../../shared/format";
import { GapMark } from "../marks";
import { Term } from "../term";
import { barBox, type Frame, isChosen, pad, Ticks, TimelineHead } from "./chart-parts";
import { colors, kinds } from "./kinds";

const stripHeight = 52;

export function AllocationRow({ frame }: { readonly frame: Frame }) {
  const { spans, span, width: W } = frame;
  const strips = kinds.map((kind) => {
    const figures = spans.map((each) => figureOf(each, kind.key));
    const peak = max(figures, (figure) => valueOf(figure) ?? 0) ?? 0;
    const scale = scaleLinear()
      .domain([0, peak > 0 ? peak : 1])
      .range([0, stripHeight - 14]);
    return {
      kind,
      scale,
      empty: figures.every((figure) => figure.kind === "gap"),
    };
  });
  const emptyStrips = strips.filter((strip) => strip.empty);

  return (
    <div className="tl-row">
      <TimelineHead>
        <span>
          <Term name="Capital allocation" /> per <Term name="Fiscal year">fiscal year</Term>
        </span>
      </TimelineHead>
      {strips
        .filter((strip) => !strip.empty)
        .map(({ kind, scale }) => {
          const figure = figureOf(span, kind.key);
          const top = scale.domain()[1]!;
          return (
            <div className="tl-sub" key={kind.key}>
              <div className="tl-sub-head">
                <span>
                  {kind.label}, fiscal {span.fiscalYear}:
                </span>
                {figure.kind === "gap" ? (
                  <GapMark />
                ) : (
                  <span className="numbers">{money(figure.value)}</span>
                )}
              </div>
              <div className="tl-plot">
                <Ticks
                  height={stripHeight}
                  ticks={[{ y: stripHeight - 1 - scale(top), text: axisMoney(top) }]}
                />
                <svg
                  width={W}
                  height={stripHeight}
                  role="img"
                  aria-label={`${capitalise(kind.plain)} for each fiscal year, up to ${axisMoney(top)}`}
                >
                  <line
                    className="grid-line"
                    x1={pad.left}
                    x2={W - pad.right}
                    y1={stripHeight - 1 - scale(top)}
                    y2={stripHeight - 1 - scale(top)}
                  />
                  <line
                    x1={pad.left}
                    x2={W - pad.right}
                    y1={stripHeight - 0.5}
                    y2={stripHeight - 0.5}
                    stroke="var(--color-hairline)"
                  />
                  {spans.map((each) => {
                    const value = figureOf(each, kind.key);
                    const { left, width } = barBox(frame, each);
                    const label = `${capitalise(kind.plain)}, fiscal ${each.fiscalYear}: ${value.kind === "gap" ? "gap, not reported as its own line" : money(value.value)}`;
                    if (value.kind === "gap") {
                      return (
                        <rect
                          key={each.fiscalYear}
                          data-tip={label}
                          data-month={each.endOn.slice(0, 7)}
                          x={left + 0.5}
                          y={stripHeight - 9.5}
                          width={width - 1}
                          height={8}
                          rx={3}
                          fill="transparent"
                          stroke="var(--color-text-3)"
                          strokeDasharray="3 3"
                          opacity={isChosen(frame, each) ? 1 : 0.7}
                        />
                      );
                    }
                    const h = Math.max(value.value > 0 ? 2 : 0, scale(value.value));
                    return (
                      <g key={each.fiscalYear} data-tip={label} data-month={each.endOn.slice(0, 7)}>
                        <rect
                          x={left}
                          width={width}
                          y={stripHeight - 1 - h}
                          height={h + 1}
                          rx={2}
                          fill={isChosen(frame, each) ? colors.barChosen : colors.bar}
                        />
                        <rect
                          x={left - 4}
                          width={width + 8}
                          y={0}
                          height={stripHeight}
                          fill="transparent"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          );
        })}
      {emptyStrips.length > 0 && (
        <p className="tl-none">
          {emptyStrips.map(({ kind }, index) => (
            <span key={kind.key}>
              {index > 0 && (index === emptyStrips.length - 1 ? " and " : ", ")}
              {index === 0 ? kind.label : kind.inline}
            </span>
          ))}
          : not reported as {emptyStrips.length === 1 ? "its" : "their"} own line in any year.
        </p>
      )}
    </div>
  );
}
