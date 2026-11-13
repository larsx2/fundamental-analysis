import { Popover } from "@base-ui/react/popover";
import type { StatementYear } from "../../functions/company";
import { figureOf, formatValue, ratioKeys } from "../../shared/figure-keys";
import { valueOf } from "../../shared/figures";
import { longDate, percent } from "../../shared/format";
import type { ReadyCompany } from "../company-frame";
import { Icon } from "../icons";
import { shortName } from "../logo-tile";
import { GapMark } from "../marks";
import { FigureNotes } from "../own-figure";
import { Term } from "../term";
import { labelOf, type Row, statements, type Tab } from "./rows";

type CellPayload = { readonly row: Row; readonly year: StatementYear };
export const figureCard = Popover.createHandle<CellPayload>();

// Where a number came from: the period it covers, the filing, and its marks.
export function FigureCard({ view, tab }: { readonly view: ReadyCompany; readonly tab: Tab }) {
  const name = shortName(view.name);
  return (
    <Popover.Root handle={figureCard}>
      {({ payload }) => {
        if (payload === undefined) return null;
        const { row, year } = payload;
        const figure = figureOf(year, row.key);
        const revenue = valueOf(year.terms.revenue);
        const when = statements[tab].instant
          ? `On ${longDate(year.endOn)}, the last day of fiscal ${year.fiscalYear}.`
          : `Over fiscal ${year.fiscalYear}, from ${longDate(year.startOn)} to ${longDate(year.endOn)}.`;
        return (
          <Popover.Portal>
            <Popover.Positioner
              side="bottom"
              align="end"
              sideOffset={8}
              collisionPadding={16}
              className="z-50"
            >
              <Popover.Popup className="card figure-card">
                <Popover.Close className="close" aria-label="Close">
                  <Icon name="close" className="h-4 w-4" />
                </Popover.Close>
                <p className="eyebrow">
                  {name} in fiscal {year.fiscalYear}
                </p>
                <Popover.Title render={<h3 />}>
                  <Term name={row.term}>{labelOf(row)}</Term>
                </Popover.Title>
                {figure.kind === "gap" ? (
                  <>
                    <div className="figure-line">
                      <GapMark />
                    </div>
                    <p className="note">
                      {name}'s annual report for fiscal {year.fiscalYear} has no figure for{" "}
                      {labelOf(row).toLowerCase()} that the tool can read. It is not zero.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="figure-line">
                      <span className="numbers">{formatValue(row.key, figure.value)}</span>
                      {tab === "income" &&
                      row.unit === undefined &&
                      !ratioKeys.has(row.key) &&
                      row.key !== "revenue" &&
                      revenue !== null &&
                      revenue !== 0
                        ? `, ${percent(figure.value / revenue)} of revenue`
                        : ""}
                    </div>
                    <p className="note">{when}</p>
                    <FigureNotes
                      figure={figure}
                      figureKey={row.key}
                      cik={view.cik}
                      companyName={name}
                      termName={labelOf(row)}
                    />
                  </>
                )}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        );
      }}
    </Popover.Root>
  );
}
