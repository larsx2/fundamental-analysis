import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { scaleLinear } from "d3-scale";
import { curveBumpX, line } from "d3-shape";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { revenueHistoryQuery, type RevenueHistory } from "../../functions/companies";
import { axisMoney, moneyShort } from "../../shared/format";
import { LogoTile, plainName, shortName } from "../logo-tile";
import { useStill } from "../motion";

const shades = [
  "var(--color-text-1)",
  "var(--color-text-2)",
  "var(--color-text-3)",
  "var(--color-flow-total)",
  "var(--color-bar-neutral)",
];
const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
const labelGap = 38;
const glintRun = 2600;
const glintRest = 4000;
const glintLength = 70;

type Drawn = RevenueHistory & { readonly shade: string };

const path = line<{ readonly x: number; readonly y: number }>()
  .x((point) => point.x)
  .y((point) => point.y)
  .curve(curveBumpX);

const useSize = () => {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { box, ...size };
};

export function RevenueExhibit() {
  const { data } = useQuery(revenueHistoryQuery);
  const still = useStill();
  const { box, width, height } = useSize();
  const svg = useRef<SVGSVGElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const arrived = useRef(false);
  const [focused, setFocused] = useState<number | null>(null);

  const companies: ReadonlyArray<Drawn> = (data ?? [])
    .filter((company) => company.points.length > 0)
    .toSorted((a, b) => (b.points.at(-1)?.value ?? 0) - (a.points.at(-1)?.value ?? 0))
    .map((company, index) => ({
      ...company,
      shade: shades[index % shades.length]!,
    }));

  const narrow = width < 560;
  const margin = { left: 48, right: narrow ? 104 : 210, top: 8, bottom: 26 };
  const years = companies.flatMap((company) => company.points.map((point) => point.fiscalYear));
  const first = Math.min(...years);
  const last = Math.max(...years);
  const x = scaleLinear()
    .domain([first, Math.max(last, first + 1)])
    .range([margin.left, width - margin.right]);
  const y = scaleLinear()
    .domain([0, Math.max(1, ...companies.flatMap((c) => c.points.map((p) => p.value)))])
    .nice(5)
    .range([height - margin.bottom, margin.top]);

  const series = companies.map((company) => {
    const points = company.points.map((point) => ({
      x: x(point.fiscalYear),
      y: y(point.value),
    }));
    return {
      company,
      points,
      end: points.at(-1)!,
      latest: company.points.at(-1)!,
    };
  });

  const placed = series.toSorted((a, b) => a.end.y - b.end.y).map((each) => ({ ...each, at: 0 }));
  const lowest = height - margin.bottom - 10;
  placed.forEach((each, index) => {
    const above = placed[index - 1];
    each.at =
      above === undefined ? Math.max(16, each.end.y) : Math.max(each.end.y, above.at + labelGap);
  });
  for (let index = placed.length - 1; index >= 0; index--) {
    const each = placed[index]!;
    const below = placed[index + 1];
    each.at = Math.min(each.at, below === undefined ? lowest : below.at - labelGap);
  }

  const step = narrow ? 6 : 3;
  const yearTicks: Array<number> = [];
  for (let year = last; year >= first; year -= step) yearTicks.unshift(year);
  const shape = `${width}x${height}:${series.map((each) => `${each.company.cik}-${each.points.length}`).join(",")}`;

  useLayoutEffect(() => {
    const drawing = svg.current;
    if (drawing === null || width === 0 || still) return;
    const running: Array<Animation> = [];
    const entering = !arrived.current;
    const lines = [...drawing.querySelectorAll<SVGPathElement>("path.line")];
    const glints = [...drawing.querySelectorAll<SVGPathElement>("path.glint")];
    const dots = [...drawing.querySelectorAll<SVGCircleElement>("circle.end")];
    const cycle = glintRun * lines.length + glintRest;
    const share = glintRun / cycle;
    lines.forEach((each, index) => {
      const length = each.getTotalLength();
      if (entering) {
        running.push(
          each.animate(
            [
              { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
              { strokeDasharray: `${length}`, strokeDashoffset: "0" },
            ],
            {
              duration: 2200,
              delay: 700 + index * 160,
              easing: ease,
              fill: "backwards",
            },
          ),
        );
        dots[index]?.animate(
          [
            { opacity: 0, transform: "scale(0.2)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          {
            duration: 500,
            delay: 2300 + index * 160,
            easing: ease,
            fill: "backwards",
          },
        );
      }
      const glint = glints[index];
      if (glint === undefined || length === 0) return;
      const dash = `${glintLength} ${length + glintLength}`;
      running.push(
        glint.animate(
          [
            {
              offset: 0,
              opacity: 0,
              strokeDasharray: dash,
              strokeDashoffset: `${glintLength}`,
              easing: "cubic-bezier(0.45, 0, 0.2, 1)",
            },
            { offset: share * 0.1, opacity: 0.9 },
            { offset: share * 0.85, opacity: 0.9 },
            {
              offset: share,
              opacity: 0,
              strokeDasharray: dash,
              strokeDashoffset: `${-length}`,
            },
            {
              offset: 1,
              opacity: 0,
              strokeDasharray: dash,
              strokeDashoffset: `${-length}`,
            },
          ],
          {
            duration: cycle,
            delay: 3600 + index * glintRun,
            iterations: Infinity,
          },
        ),
      );
    });
    if (entering) {
      for (const label of labels.current?.querySelectorAll("a") ?? []) {
        const index = Number(label.dataset["order"]);
        label.animate(
          [
            { opacity: 0, transform: "translate(-6px, -50%)" },
            { opacity: 1, transform: "translate(0, -50%)" },
          ],
          {
            duration: 600,
            delay: 2400 + index * 160,
            easing: ease,
            fill: "backwards",
          },
        );
      }
    }
    arrived.current = true;
    return () => {
      for (const animation of running) animation.cancel();
    };
  }, [shape, still]);

  if (data !== undefined && companies.length === 0) return null;

  return (
    <figure className={`exhibit ${narrow ? "narrow" : ""} ${focused === null ? "" : "focused"}`}>
      <div
        className="exhibit-chart"
        ref={box}
        style={{
          minHeight: companies.length * labelGap + margin.top + margin.bottom,
        }}
      >
        {width > 0 && companies.length > 0 && (
          <>
            <svg ref={svg} role="img" aria-labelledby="exhibit-title">
              <title id="exhibit-title">
                Revenue of Apple, Microsoft, Costco, Tesla and NVIDIA, by fiscal year
              </title>
              <defs>
                <filter id="exhibit-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.4" />
                </filter>
              </defs>
              <g className="exhibit-grid">
                {y.ticks(5).map((tick) => (
                  <line
                    key={tick}
                    className={tick === 0 ? "baseline" : undefined}
                    x1={margin.left}
                    x2={width - margin.right + 40}
                    y1={y(tick)}
                    y2={y(tick)}
                  />
                ))}
              </g>
              <g className="exhibit-axis">
                {y
                  .ticks(5)
                  .filter((tick) => tick > 0)
                  .map((tick) => (
                    <text key={tick} x={0} y={y(tick) + 4}>
                      {axisMoney(tick)}
                    </text>
                  ))}
                {yearTicks.map((year) => (
                  <text key={year} x={x(year)} y={height - 4} textAnchor="middle">
                    {year}
                  </text>
                ))}
              </g>
              {series.map(({ company, points, end }) => (
                <g
                  key={company.cik}
                  className={`exhibit-series ${focused === company.cik ? "on" : ""}`}
                  style={{ "--shade": company.shade } as CSSProperties}
                >
                  <path className="line" d={path(points) ?? ""} />
                  <path className="glint" d={path(points) ?? ""} filter="url(#exhibit-glow)" />
                  <circle
                    className="end"
                    cx={end.x}
                    cy={end.y}
                    r={3.5}
                    style={{ transformOrigin: `${end.x}px ${end.y}px` }}
                  />
                </g>
              ))}
            </svg>
            <div className="exhibit-labels" ref={labels}>
              {placed.map(({ company, end, at, latest }) => {
                const order = series.findIndex((each) => each.company.cik === company.cik);
                return (
                  <Link
                    key={company.cik}
                    to="/$ticker/overview"
                    params={{ ticker: company.ticker }}
                    search={{}}
                    data-order={order}
                    className={focused === company.cik ? "on" : undefined}
                    style={{ left: end.x + 14, top: at }}
                    aria-label={`${shortName(company.name)}, revenue ${moneyShort(latest.value)} in fiscal ${latest.fiscalYear}`}
                    onPointerEnter={() => setFocused(company.cik)}
                    onPointerLeave={() => setFocused(null)}
                    onFocus={() => setFocused(company.cik)}
                    onBlur={() => setFocused(null)}
                  >
                    <LogoTile name={plainName(company.name)} cik={company.cik} size={24} />
                    {company.ticker}
                    <span>
                      {moneyShort(latest.value)} in {latest.fiscalYear}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
      <figcaption>
        <span>Revenue by fiscal year, as each company reported it in its annual reports.</span>
        <Link to="/companies">All companies</Link>
      </figcaption>
    </figure>
  );
}
