import { type ReactNode, useRef } from "react";
import type { Drawing } from "../../shared/lookups";
import { useChartTip } from "../chart-tip";
import { useWidth } from "../motion";
import { Body } from "./drawing/body";

export function DrawingPanel({
  drawing,
  link,
  linked,
}: {
  readonly drawing: Drawing;
  readonly link: ReactNode;
  readonly linked: ReadonlySet<string>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const width = Math.max(260, useWidth(box, 720));
  const tip = useChartTip();
  return (
    <section className="panel panel-pad ask-drawing" aria-label={drawing.title}>
      <div className="panel-title">
        <h2>{drawing.title}</h2>
        {link}
      </div>
      <div ref={box} onMouseLeave={tip.hide}>
        <Body drawing={drawing} width={width} tip={tip} linked={linked} />
      </div>
      {tip.element}
    </section>
  );
}
