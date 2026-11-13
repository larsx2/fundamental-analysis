import type { ReactNode } from "react";
import type { StatementYear } from "../../functions/company";
import { type FigureKey, figureOf } from "../../shared/figure-keys";
import { valueOf } from "../../shared/figures";
import { moneyParts, percent, perShare } from "../../shared/format";
import { GapMark, Marks } from "../marks";
import { Term } from "../term";
import { Sparkline } from "./sparkline";
import { changeOf, type TileKind } from "./words";

const valueText = (kind: TileKind, value: number | null): ReactNode => {
  if (value === null) return <GapMark />;
  if (kind === "perShare") return perShare(value);
  if (kind === "ratio") return percent(value);
  const { amount, unit } = moneyParts(value);
  return (
    <>
      {amount}
      {unit !== "" && <small> {unit}</small>}
    </>
  );
};

export function KeyFigures({
  years,
  year,
}: {
  readonly years: ReadonlyArray<StatementYear>;
  readonly year: StatementYear;
}) {
  const before = years.find((each) => each.fiscalYear === year.fiscalYear - 1);
  const tileOf = (key: FigureKey, kind: TileKind) => {
    const now = valueOf(figureOf(year, key));
    const then = before === undefined ? null : valueOf(figureOf(before, key));
    return {
      key,
      kind,
      value: valueText(kind, now),
      change: changeOf(kind, now, then),
    };
  };
  const tiles: ReadonlyArray<{
    term: string;
    tile: ReturnType<typeof tileOf>;
    marksFrom: FigureKey;
  }> = [
    { term: "Revenue", tile: tileOf("revenue", "money"), marksFrom: "revenue" },
    {
      term: "Gross margin",
      tile: tileOf("grossMargin", "ratio"),
      marksFrom: "grossProfit",
    },
    {
      term: "Operating margin",
      tile: tileOf("operatingMargin", "ratio"),
      marksFrom: "operatingIncome",
    },
    {
      term: "Net income",
      tile: tileOf("netIncome", "money"),
      marksFrom: "netIncome",
    },
    {
      term: "Free cash flow",
      tile: tileOf("freeCashFlow", "money"),
      marksFrom: "freeCashFlow",
    },
    {
      term: "Earnings per share",
      tile: tileOf("earningsPerShare", "perShare"),
      marksFrom: "earningsPerShare",
    },
  ];
  // Each tile draws its last ten fiscal years, up to the one shown.
  const recent = years.filter((each) => each.fiscalYear <= year.fiscalYear).slice(-10);
  const trendOf = (key: FigureKey) => recent.map((each) => valueOf(figureOf(each, key)));
  const tile = ({ term, tile, marksFrom }: (typeof tiles)[number]) => (
    <Tile
      key={term}
      term={term}
      value={tile.value}
      change={tile.change}
      trend={trendOf(tile.key)}
      ratio={tile.kind === "ratio"}
      trendLabel={`${term}, fiscal ${recent[0]?.fiscalYear} to fiscal ${year.fiscalYear}`}
      marks={<Marks figure={figureOf(year, marksFrom)} />}
    />
  );

  return (
    <section aria-labelledby="strip-title">
      <h2 id="strip-title" className="mt-10 mb-3 text-m font-semibold">
        Key figures for fiscal {year.fiscalYear}
        {before !== undefined && (
          <span className="font-normal text-text-3">
            , with the <Term name="Year-over-year change">year-over-year change</Term> against
            fiscal {before.fiscalYear}
          </span>
        )}
      </h2>
      <div className="strip">
        <div className="strip-row">{tiles.map(tile)}</div>
      </div>
    </section>
  );
}

function Tile({
  term,
  value,
  change,
  trend,
  ratio,
  trendLabel,
  marks,
}: {
  readonly term: string;
  readonly value: ReactNode;
  readonly change: string | null;
  readonly trend: ReadonlyArray<number | null>;
  readonly ratio: boolean;
  readonly trendLabel: string;
  readonly marks: ReactNode;
}) {
  return (
    <div className="tile">
      <div className="tile-label">
        <Term name={term} />
      </div>
      <div className="tile-value numbers">{value}</div>
      <div className="change">{change ?? "\u00a0"}</div>
      <Sparkline values={trend} ratio={ratio} label={trendLabel} />
      <div>{marks}</div>
    </div>
  );
}
