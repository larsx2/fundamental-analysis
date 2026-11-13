import { useNavigate } from "@tanstack/react-router";
import { type CSSProperties, useRef } from "react";
import { longDate, yearEndInWords } from "../shared/format";
import { LogoTile, plainName, shortName } from "./logo-tile";
import { useOpenPalette } from "./palette";
import { Term } from "./term";

// The top of every company screen: only the company's tile and ticker, which
// open the search, and the date of the newest filing held.
export function CompanyHeader({
  cik,
  name,
  ticker,
  asOf,
}: {
  readonly cik: number;
  readonly name: string;
  readonly ticker: string;
  readonly asOf: string | null;
}) {
  const openPalette = useOpenPalette();
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h1 className="visually-hidden">{plainName(name)}</h1>
      <button
        type="button"
        className="company-button"
        onClick={openPalette}
        aria-label={`${plainName(name)}. Switch company`}
      >
        <LogoTile name={plainName(name)} cik={cik} size={40} />
        <span className="text-xl font-semibold tracking-[0.01em]">{ticker}</span>
        <span className="text-m text-text-3">{shortName(name)}</span>
      </button>
      {asOf !== null && (
        <span className="text-xs text-text-3">
          <Term name="As of">As of</Term> {longDate(asOf)}
        </span>
      )}
    </div>
  );
}

// Moving through fiscal years keeps the year in the address bar. Dragging
// replaces the entry as it goes, so the back button returns to where the
// drag started rather than through every year passed.
export const useChooseYear = () => {
  const navigate = useNavigate();
  return (year: number, { replace = false }: { readonly replace?: boolean } = {}) =>
    navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => ({ ...previous, year }),
      replace,
      resetScroll: false,
    });
};

export function FiscalYearRuler({
  years,
  value,
  ends,
}: {
  readonly years: ReadonlyArray<number>;
  readonly value: number;
  readonly ends: ReadonlyArray<string>;
}) {
  const chooseYear = useChooseYear();
  const dragging = useRef(false);
  const index = Math.max(0, years.indexOf(value));
  const step = years.length > 8 ? Math.ceil(years.length / 6) : 1;
  const last = years.length - 1;
  const quiet = (at: number) =>
    at !== index && (at % step !== last % step || Math.abs(at - index) < step);

  return (
    // Each fiscal year gets room for its label, so a long history widens the
    // ruler rather than crowding it.
    <div style={{ maxWidth: Math.max(720, years.length * 50) }}>
      <div className="eyebrow mb-2">
        <Term name="Fiscal year">Fiscal year</Term>, ending {yearEndInWords(ends)}
      </div>
      <div
        className="ruler"
        style={
          {
            "--count": Math.max(2, years.length),
            "--at": index,
          } as CSSProperties
        }
      >
        <div className="ruler-track" aria-hidden="true">
          {years.map((year) => (
            <i key={year} />
          ))}
        </div>
        <span className="ruler-marker" aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={Math.max(0, last)}
          step={1}
          value={index}
          aria-label="Fiscal year"
          aria-valuetext={`Fiscal ${value}`}
          onPointerDown={() => (dragging.current = true)}
          onPointerUp={() => (dragging.current = false)}
          onChange={(event) => {
            const year = years[Number(event.target.value)];
            if (year !== undefined) void chooseYear(year, { replace: dragging.current });
          }}
        />
        <div className="ruler-labels">
          {years.map((year, at) => (
            <button
              key={year}
              type="button"
              tabIndex={-1}
              aria-current={year === value}
              data-quiet={quiet(at) ? "" : undefined}
              onClick={() => void chooseYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
