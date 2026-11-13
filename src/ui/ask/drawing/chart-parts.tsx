import type { Series, Unit } from "../../../shared/lookups";
import { useChartTip } from "../../chart-tip";
import { moneyShort, percent, perShare, signedPercent } from "../../../shared/format";
import { Term } from "../../term";

export const tones: Record<Series["tone"], string> = {
  white: "var(--color-text-1)",
  soft: "var(--color-text-2)",
  grey: "var(--color-bar-neutral)",
  kept: "var(--color-part-kept)",
};

export const write = (unit: Unit, value: number) =>
  unit === "money"
    ? moneyShort(value)
    : unit === "perShare"
      ? perShare(value)
      : unit === "share"
        ? percent(value)
        : unit === "change"
          ? signedPercent(value)
          : `${value}¢`;

export type Tip = ReturnType<typeof useChartTip>;

export const yearLabels = (years: ReadonlyArray<number>, room: number) => {
  const every = Math.max(1, Math.ceil(years.length / Math.max(2, Math.floor(room / 46))));
  const last = years.length - 1;
  return (index: number) => (last - index) % every === 0;
};

export function Caption({ series }: { readonly series: ReadonlyArray<Series> }) {
  return (
    <figcaption>
      {series.map((each) => (
        <span key={each.name} className="ask-key">
          <i
            className={each.dashed === true ? "dashed" : ""}
            style={{
              background: tones[each.tone],
              borderColor: tones[each.tone],
            }}
            aria-hidden="true"
          />
          {each.term === null ? each.name : <Term name={each.term}>{each.name}</Term>}
        </span>
      ))}
    </figcaption>
  );
}
