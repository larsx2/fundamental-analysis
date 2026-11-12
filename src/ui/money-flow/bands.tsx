import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import type { StatementYear } from "../../functions/company";
import type { CheckedFigure } from "../../shared/figures";
import { valueOf } from "../../shared/figures";
import { useChartTip } from "../chart-tip";
import { money, percent } from "../format";
import { GapMark, Marks } from "../marks";
import { glide, useMounted, useStill, useWidth } from "../motion";
import { Term } from "../term";
import { yearParts } from "./parts";

const flowHeight = 540;
const blockGap = 64;
const revealTime = 1.1;

type Node = {
  readonly id: string;
  readonly name: string;
  readonly column: number;
  readonly figure: CheckedFigure;
  readonly color: string;
  readonly total: boolean;
};

type Laid = SankeyNode<Node, object>;
type LaidLink = SankeyLink<Node, object>;

const totalFill = "var(--color-flow-total)";
const totalBand = "var(--color-flow-total-band)";

const flowFor = (year: StatementYear) => {
  const t = year.terms;
  const byKey = new Map(yearParts(year).map((part) => [part.key, part]));
  const part = (key: Parameters<typeof byKey.get>[0], column: number): Node => {
    const found = byKey.get(key)!;
    return {
      id: key,
      name: found.name,
      column,
      figure: found.figure,
      color: found.color,
      total: false,
    };
  };
  const nodes: ReadonlyArray<Node> = [
    {
      id: "revenue",
      name: "Revenue",
      column: 0,
      figure: t.revenue,
      color: totalFill,
      total: true,
    },
    part("costOfRevenue", 1),
    {
      id: "grossProfit",
      name: "Gross profit",
      column: 1,
      figure: t.grossProfit,
      color: totalFill,
      total: true,
    },
    part("researchAndDevelopment", 2),
    part("sellingGeneralAndAdministrative", 2),
    part("otherOperatingExpenses", 2),
    {
      id: "operatingIncome",
      name: "Operating income",
      column: 2,
      figure: t.operatingIncome,
      color: totalFill,
      total: true,
    },
    part("below", 3),
    part("netIncome", 3),
  ];
  const figureById = new Map(nodes.map((node) => [node.id, node.figure]));
  const positive = (id: string) => {
    const value = valueOf(figureById.get(id));
    return value !== null && value > 0 ? value : 0;
  };
  const links = [
    ["revenue", "costOfRevenue"],
    ["revenue", "grossProfit"],
    ["grossProfit", "researchAndDevelopment"],
    ["grossProfit", "sellingGeneralAndAdministrative"],
    ["grossProfit", "otherOperatingExpenses"],
    ["grossProfit", "operatingIncome"],
    ["operatingIncome", "below"],
    ["operatingIncome", "netIncome"],
  ]
    .map(([source = "", target = ""]) => ({
      source,
      target,
      value: positive(target),
    }))
    .filter((link) => link.value > 0);
  const used = new Set(links.flatMap((link) => [link.source, link.target]));
  return {
    nodes: nodes.filter((node) => used.has(node.id)),
    links,
    gaps: nodes.filter((node) => !node.total && node.figure.kind === "gap" && node.id !== "below"),
    revenue: valueOf(year.terms.revenue) ?? 0,
  };
};

type Placement = { readonly x: number; readonly y: number };

// Each bar is a tinted block wide enough to hold its own label. Bands run
// only between blocks, so a label never sits on a band.
export function Bands({
  year,
  company,
}: {
  readonly year: StatementYear;
  readonly company: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const width = Math.max(600, useWidth(box, 1100));
  const still = useStill();
  const tip = useChartTip();
  const lane = Math.round(Math.min(220, Math.max(156, width / 5.6)));
  const flow = flowFor(year);

  const graph = sankey<Node, object>()
    .nodeId((node) => node.id)
    .nodeAlign((node) => (node as Laid).column)
    .nodeSort(null)
    .nodeWidth(lane)
    .nodePadding(blockGap)
    .extent([
      [0, 0],
      [width, flowHeight],
    ])({
    nodes: flow.nodes.map((node) => ({ ...node })),
    links: flow.links.map((link) => ({ ...link })),
  });
  const nodes = graph.nodes as ReadonlyArray<Laid>;
  const links = graph.links as ReadonlyArray<LaidLink>;

  // Labels are measured after they render, then pushed apart within their
  // column so none overlap.
  const labelRefs = useRef(new Map<string, HTMLDivElement>());
  const gapRefs = useRef(new Map<string, HTMLDivElement>());
  const [placed, setPlaced] = useState<ReadonlyMap<string, Placement>>(new Map());
  const [gapTops, setGapTops] = useState<ReadonlyMap<string, number>>(new Map());

  // A new drawing sweeps in from revenue on the left; moving between fiscal
  // years glides instead.
  const shownFor = useRef<string | null>(null);
  const sweeping = shownFor.current !== company;
  useLayoutEffect(() => {
    shownFor.current = company;
  });

  useLayoutEffect(() => {
    const items = nodes.map((node) => {
      const h = labelRefs.current.get(node.id)?.offsetHeight ?? 48;
      return {
        id: node.id,
        column: (node as Node).column,
        h,
        x: (node.x0 ?? 0) + 14,
        y: ((node.y0 ?? 0) + (node.y1 ?? 0)) / 2 - h / 2,
      };
    });
    for (const column of [0, 1, 2, 3]) {
      const inColumn = items.filter((item) => item.column === column).sort((a, b) => a.y - b.y);
      inColumn.forEach((item, index) => {
        const above = inColumn[index - 1];
        item.y = Math.max(item.y, above === undefined ? 0 : above.y + above.h + 8);
      });
      for (let index = inColumn.length - 1; index >= 0; index--) {
        const item = inColumn[index]!;
        const below = inColumn[index + 1];
        item.y = Math.min(item.y, below === undefined ? flowHeight - item.h : below.y - item.h - 8);
      }
    }
    const next = new Map(items.map((item) => [item.id, { x: item.x, y: item.y }]));
    const tops = new Map<string, number>();
    for (const gap of flow.gaps) {
      const first = nodes
        .filter((node) => (node as Node).column === gap.column)
        .sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0))[0];
      if (first === undefined) continue;
      const h = gapRefs.current.get(gap.id)?.offsetHeight ?? 44;
      const firstLabel = next.get(first.id)?.y ?? first.y0 ?? 0;
      tops.set(gap.id, Math.max(0, Math.min((first.y0 ?? 0) - h - 14, firstLabel - h - 8)));
    }
    const same =
      next.size === placed.size &&
      [...next].every(([id, at]) => {
        const was = placed.get(id);
        return was !== undefined && Math.abs(was.x - at.x) < 0.5 && Math.abs(was.y - at.y) < 0.5;
      }) &&
      [...tops].every(([id, top]) => Math.abs((gapTops.get(id) ?? -1) - top) < 0.5);
    if (!same) {
      setPlaced(next);
      setGapTops(tops);
    }
  });

  const linkPath = sankeyLinkHorizontal();
  const transition = still ? { duration: 0 } : glide;
  const delayAt = (x: number) =>
    still || !sweeping ? 0 : Math.min(1, (x + 40) / width) * revealTime;

  if (!mounted) return <div ref={box} style={{ height: flowHeight }} />;

  return (
    <div ref={box} className="relative" style={{ height: flowHeight }}>
      <svg
        viewBox={`0 0 ${width} ${flowHeight}`}
        width="100%"
        height={flowHeight}
        role="img"
        aria-label={`Bands following each dollar of ${company}'s revenue in fiscal ${year.fiscalYear}, from revenue to net income`}
        className="block overflow-visible"
      >
        <defs>
          <clipPath id="flow-reveal">
            <motion.rect
              y={-10}
              height={flowHeight + 20}
              initial={still ? false : { width: 0 }}
              animate={{ width: width + 20 }}
              transition={
                still ? { duration: 0 } : { duration: revealTime, ease: [0.65, 0, 0.35, 1] }
              }
              key={company}
            />
          </clipPath>
        </defs>
        <g fill="none" clipPath="url(#flow-reveal)">
          {links.map((link) => {
            const target = link.target as Laid;
            const d = linkPath(link) ?? "";
            return (
              <motion.path
                key={`${(link.source as Laid).id}-${target.id}`}
                initial={false}
                animate={{ d, strokeWidth: Math.max(1, link.width ?? 1) }}
                transition={transition}
                style={{
                  stroke: target.total ? totalBand : target.color,
                  strokeOpacity: target.total ? 0.2 : 0.38,
                }}
                onMouseMove={(event) =>
                  tip.show(
                    event,
                    <>
                      <strong>{target.name}</strong>
                      <br />
                      {money(link.value)}, {percent(link.value / flow.revenue)} of revenue
                    </>,
                  )
                }
                onMouseLeave={tip.hide}
              />
            );
          })}
        </g>
        <g clipPath="url(#flow-reveal)">
          {nodes.map((node) => {
            const color = node.total ? totalFill : node.color;
            const place = {
              x: node.x0 ?? 0,
              y: node.y0 ?? 0,
              height: Math.max(2, (node.y1 ?? 0) - (node.y0 ?? 0)),
            };
            return (
              <g key={node.id}>
                <motion.rect
                  initial={false}
                  animate={{ ...place, width: (node.x1 ?? 0) - (node.x0 ?? 0) }}
                  transition={transition}
                  style={{ fill: color, fillOpacity: node.total ? 0.1 : 0.14 }}
                />
                <motion.rect
                  initial={false}
                  animate={place}
                  width={4}
                  rx={1.5}
                  transition={transition}
                  style={{ fill: color }}
                />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0">
        {nodes.map((node) => {
          const at = placed.get(node.id);
          const value = valueOf(node.figure);
          return (
            <motion.div
              key={node.id}
              ref={(element) => {
                if (element === null) labelRefs.current.delete(node.id);
                else labelRefs.current.set(node.id, element);
              }}
              className="pointer-events-auto absolute text-xs leading-[1.35]"
              style={{ width: lane - 20 }}
              initial={still ? false : { opacity: 0 }}
              animate={{
                opacity: at === undefined ? 0 : 1,
                left: at?.x ?? (node.x0 ?? 0) + 14,
                top: at?.y ?? 0,
              }}
              transition={{
                left: transition,
                top: at === undefined ? { duration: 0 } : transition,
                opacity: {
                  duration: still ? 0 : 0.32,
                  delay: delayAt(node.x0 ?? 0),
                },
              }}
            >
              <div className={node.total ? "text-text-1" : "text-text-2"}>
                <Term name={node.name} />
              </div>
              <div className="numbers flex flex-wrap items-center gap-x-2 gap-y-0.5 text-s font-semibold whitespace-nowrap text-text-1">
                {value === null ? <GapMark /> : money(value)}
                {value !== null && flow.revenue > 0 && (
                  <span className="font-normal text-text-3">{percent(value / flow.revenue)}</span>
                )}
                <span className="font-normal">
                  <Marks figure={node.figure} />
                </span>
              </div>
            </motion.div>
          );
        })}
        {flow.gaps.map((gap) => {
          const first = nodes.find((node) => (node as Node).column === gap.column);
          if (first === undefined) return null;
          return (
            <div
              key={gap.id}
              ref={(element) => {
                if (element === null) gapRefs.current.delete(gap.id);
                else gapRefs.current.set(gap.id, element);
              }}
              className="flow-gap pointer-events-auto absolute"
              style={{
                left: first.x0 ?? 0,
                width: lane,
                top: gapTops.get(gap.id) ?? 0,
              }}
            >
              <Term name={gap.name} />
              <GapMark />
            </div>
          );
        })}
      </div>
      {tip.element}
    </div>
  );
}
