import type { ScaleTime } from "d3-scale";
import type { ReactNode } from "react";
import type { CorporateEvent } from "../../functions/company";
import type { Span } from "./time";

export const pad = { left: 52, right: 16 };
export const axisHeight = 52;

// What every row of the timeline draws against: the fiscal years, the chosen
// one, the full width and where each date falls across it.
export type Frame = {
  readonly spans: ReadonlyArray<Span>;
  readonly span: Span;
  readonly width: number;
  readonly x: ScaleTime<number, number>;
};

export const isChosen = (frame: Frame, each: Span) => each === frame.span;

export const barBox = (frame: Frame, each: Span, share = 0.56) => {
  const left = frame.x(each.start);
  const right = frame.x(each.end);
  const width = Math.min(34, (right - left) * share);
  return { left: (left + right) / 2 - width / 2, width };
};

export const officerIcon = (fill: string) => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <circle cx="6" cy="6" r="4.5" fill={fill} />
  </svg>
);
export const businessIcon = (fill: string) => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path d="M6 0.8 11.2 6 6 11.2 0.8 6Z" fill={fill} />
  </svg>
);
export const eventPlain = (event: CorporateEvent) =>
  event.kind === "business"
    ? "Acquisition or sale of a business completed"
    : "Change among directors or officers";

// The scale of a chart stays in view while the timeline scrolls sideways,
// in a margin the bars never enter.
export function Ticks({
  height,
  ticks,
}: {
  readonly height: number;
  readonly ticks: ReadonlyArray<{ readonly y: number; readonly text: string }>;
}) {
  return (
    <div className="tl-ticks" style={{ width: pad.left, height }} aria-hidden="true">
      {ticks.map((tick) => (
        <span key={tick.text} style={{ top: tick.y }}>
          {tick.text}
        </span>
      ))}
    </div>
  );
}

export function Years({
  frame,
  shown,
}: {
  readonly frame: Frame;
  readonly shown: (index: number) => boolean;
}) {
  const { spans, x, width } = frame;
  return (
    <svg width={width} height={22} aria-hidden="true">
      {spans.map((each, index) => (
        <text
          key={each.fiscalYear}
          className={`tl-year ${isChosen(frame, each) ? "current" : ""}`}
          x={(x(each.start) + x(each.end)) / 2}
          y={16}
          textAnchor="middle"
          opacity={shown(index) ? 1 : 0}
        >
          {each.fiscalYear}
        </text>
      ))}
    </svg>
  );
}

export function TimelineHead({ children }: { readonly children: ReactNode }) {
  return <div className="tl-head">{children}</div>;
}

export function Pill({
  x,
  width,
  text,
}: {
  readonly x: number;
  readonly width: number;
  readonly text: string;
}) {
  const pillWidth = text.length * 7.2 + 16;
  const at = Math.min(Math.max(x, pillWidth / 2), width - pillWidth / 2);
  return (
    <g className="tl-pill">
      <rect x={at - pillWidth / 2} y={29} width={pillWidth} height={20} rx={10} />
      <text x={at} y={43} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}
