import type { CorporateEvent } from "../../functions/company";
import { longDate } from "../../shared/format";
import { Term } from "../term";
import {
  businessIcon,
  eventPlain,
  type Frame,
  officerIcon,
  pad,
  TimelineHead,
} from "./chart-parts";
import { day, fiscalOf } from "./time";

const eventsHeight = 36;
const eventsLine = 18;

export function EventsRow({
  frame,
  events,
  eventsFrom,
}: {
  readonly frame: Frame;
  readonly events: ReadonlyArray<CorporateEvent>;
  readonly eventsFrom: string | null;
}) {
  const { spans, span, x, width: W } = frame;
  const covered = eventsFrom === null ? null : day(eventsFrom);
  const shown = events
    .filter(
      (event) => day(event.filedOn) >= spans[0]!.start && day(event.filedOn) <= spans.at(-1)!.end,
    )
    .toSorted((a, b) => a.filedOn.localeCompare(b.filedOn));
  const clusters = spans
    .map((each) => ({
      span: each,
      events: shown.filter((event) => fiscalOf(spans, day(event.filedOn)) === each),
    }))
    .filter((cluster) => cluster.events.length > 0);
  const kindsShown = new Set(shown.map((event) => event.kind));

  return (
    <div className="tl-row">
      <TimelineHead>
        <span>
          <Term name="Corporate event">Corporate events</Term> from{" "}
          <Term name="Current report (8-K)">current reports (8-K)</Term>
        </span>
        <span className="tl-legend">
          {kindsShown.has("officers") && (
            <span>
              {officerIcon("var(--color-text-1)")}
              <span>Change among directors or officers</span>
            </span>
          )}
          {kindsShown.has("business") && (
            <span>
              {businessIcon("var(--color-text-1)")}
              <span>
                <Term name="Acquisition" /> or sale of a business
              </span>
            </span>
          )}
        </span>
      </TimelineHead>
      <svg
        width={W}
        height={eventsHeight}
        role="img"
        aria-label={`${shown.length} current reports (8-K) with item 5.02 or 2.01`}
      >
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={eventsLine}
          y2={eventsLine}
          stroke="var(--color-hairline)"
        />
        {covered !== null && covered > spans[0]!.start && (
          <g
            data-tip={`Gap: current reports (8-K) filed before ${longDate(eventsFrom!)} are not in this timeline`}
          >
            <rect
              x={x(spans[0]!.start) + 0.5}
              y={6.5}
              width={Math.max(0, x(covered) - x(spans[0]!.start) - 4)}
              height={eventsHeight - 13}
              rx={4}
              fill="var(--color-surface-1)"
              stroke="var(--color-text-3)"
              strokeDasharray="3 3"
            />
            {x(covered) - x(spans[0]!.start) > 40 && (
              <text
                className="tl-text"
                x={(x(spans[0]!.start) + x(covered)) / 2}
                y={eventsHeight / 2 + 4}
                textAnchor="middle"
              >
                gap
              </text>
            )}
          </g>
        )}
        {clusters.map((cluster) => {
          const first = cluster.events[0]!;
          const lastEvent = cluster.events.at(-1)!;
          const px =
            cluster.events.length > 1
              ? (x(cluster.span.start) + x(cluster.span.end)) / 2
              : x(day(first.filedOn));
          const cy = eventsLine;
          const inYear = cluster.span === span;
          const fill = inYear ? "var(--color-text-1)" : "var(--color-text-3)";
          if (cluster.events.length > 1) {
            const count = cluster.events.length;
            return (
              <g
                key={cluster.span.fiscalYear}
                data-tip={`Fiscal ${cluster.span.fiscalYear}: ${count} current reports (8-K), filed ${longDate(first.filedOn)} to ${longDate(lastEvent.filedOn)}`}
                data-month={lastEvent.filedOn.slice(0, 7)}
                className="cursor-pointer"
              >
                <circle
                  cx={px}
                  cy={cy}
                  r={8.5}
                  fill={fill}
                  stroke="var(--color-surface-1)"
                  strokeWidth={2}
                />
                <text className="tl-count" x={px} y={cy + 4} textAnchor="middle">
                  {count}
                </text>
              </g>
            );
          }
          return (
            <g
              key={`${first.accession}-${first.kind}`}
              data-tip={`${eventPlain(first)}, filed on ${longDate(first.filedOn)}${first.amendedOn === null ? "" : `, amended on ${longDate(first.amendedOn)}`}`}
              data-month={first.filedOn.slice(0, 7)}
              className="cursor-pointer"
            >
              <circle cx={px} cy={cy} r={8} fill="transparent" />
              {first.kind === "business" ? (
                <path
                  d={`M${px},${cy - 6.5}L${px + 6.5},${cy}L${px},${cy + 6.5}L${px - 6.5},${cy}Z`}
                  fill={fill}
                  stroke="var(--color-surface-1)"
                  strokeWidth={2}
                />
              ) : (
                <circle
                  cx={px}
                  cy={cy}
                  r={4.5}
                  fill={fill}
                  stroke="var(--color-surface-1)"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
