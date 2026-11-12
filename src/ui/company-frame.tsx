import { useSuspenseQuery } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect } from "react";
import { type CompanyView, companyQuery, type StatementYear } from "../functions/company";
import { CompanyHeader, FiscalYearRuler, useChooseYear } from "./company-header";
import { writeLastCompany } from "./last-company";
import { plainName, shortName } from "./logo-tile";
import { ownFigureLine } from "./own-figure";
import type { CompanyScreen } from "./palette";
import { Screen } from "./screen";
import { OwnFigures } from "./term";

export type ReadyCompany = CompanyView & {
  readonly details: NonNullable<CompanyView["details"]>;
};

// A ready company and the fiscal year the address asks for, or its latest.
export const useReadyCompany = (ticker: string, asked: number | undefined) => {
  const { data } = useSuspenseQuery(companyQuery(ticker));
  const view = data as ReadyCompany;
  const years = view.details.years;
  const year = years.find((each) => each.fiscalYear === asked) ?? years.at(-1)!;
  return { view, years, year };
};

export const searchYear = (search: Record<string, unknown>) =>
  typeof search.year === "number" && Number.isInteger(search.year) ? search.year : undefined;

const typing = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest(
    "input, textarea, select, [role=slider], [role=tablist], [role=group], [role=dialog], [contenteditable]",
  ) !== null;

export function CompanyFrame({
  view,
  year,
  active,
  title,
  extraOwnFigure,
  children,
}: {
  readonly view: ReadyCompany;
  readonly year: StatementYear;
  readonly active: CompanyScreen;
  readonly title: string;
  readonly extraOwnFigure?: (termName: string) => ReactNode;
  readonly children: ReactNode;
}) {
  const chooseYear = useChooseYear();
  const years = view.details.years.map((each) => each.fiscalYear);
  const name = shortName(view.name);

  useEffect(() => {
    document.title = `${plainName(view.name)}: ${title}`;
  }, [view.name, title]);

  useEffect(() => {
    writeLastCompany({ ticker: view.ticker, year: year.fiscalYear });
  }, [view.ticker, year.fiscalYear]);

  // The left and right arrows move through the fiscal years from anywhere on
  // the screen, unless something that takes arrows of its own has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (typing(event.target)) return;
      const at = years.indexOf(year.fiscalYear);
      const next =
        event.key === "ArrowLeft"
          ? years[at - 1]
          : event.key === "ArrowRight"
            ? years[at + 1]
            : undefined;
      if (next === undefined) return;
      event.preventDefault();
      void chooseYear(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ownFigure = useCallback(
    (termName: string) =>
      extraOwnFigure?.(termName) ??
      ownFigureLine({ termName, year, cik: view.cik, companyName: name }),
    [extraOwnFigure, year, view.cik, name],
  );

  return (
    <OwnFigures figure={ownFigure}>
      <Screen active={active}>
        <div className="mb-8">
          <CompanyHeader cik={view.cik} name={view.name} ticker={view.ticker} asOf={view.asOf} />
          <FiscalYearRuler
            years={years}
            value={year.fiscalYear}
            ends={view.details.years.map((each) => each.endOn)}
          />
        </div>
        {children}
      </Screen>
    </OwnFigures>
  );
}
