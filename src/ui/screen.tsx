import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { companiesQuery } from "../functions/companies";
import { Icon, type IconName } from "./icons";
import { readLastCompany } from "./last-company";
import { companyScreens, type CompanyScreen, useHere, useOpenPalette } from "./palette";

export type ScreenName = "home" | "companies" | "glossary" | CompanyScreen;

const ScreenLink = ({
  to,
  label,
  icon,
  active,
  ticker,
  year,
}: {
  readonly to: string;
  readonly label: string;
  readonly icon: IconName;
  readonly active: boolean;
  readonly ticker?: string | null;
  readonly year?: number | null;
}) => (
  <Link
    to={to}
    params={ticker === undefined || ticker === null ? {} : { ticker }}
    search={year === undefined || year === null ? {} : { year }}
    aria-label={label}
    data-label={label}
    activeOptions={{ exact: true, includeSearch: false }}
    activeProps={{ "aria-current": active ? "page" : undefined }}
    inactiveProps={{ "aria-current": active ? "page" : undefined }}
  >
    <Icon name={icon} />
  </Link>
);

// The small bar at the bottom centre. Names show as tooltips, and only the
// icon under the pointer grows.
export function BottomBar({ active }: { readonly active: ScreenName }) {
  const here = useHere();
  const openPalette = useOpenPalette();
  const [last, setLast] = useState<{
    ticker: string;
    year: number | null;
  } | null>(null);
  useEffect(() => setLast(readLastCompany()), []);
  const navigate = useNavigate();
  const { data } = useQuery(companiesQuery);
  const firstReady = data?.companies.find((company) => company.state === "ready")?.ticker ?? null;
  const ticker = here.ticker ?? last?.ticker ?? firstReady;
  const year = here.ticker !== null ? here.year : (last?.year ?? null);

  return (
    <>
      <div className="dock-fade" aria-hidden="true" />
      <div className="dock">
        <nav aria-label="Screens">
          <ScreenLink to="/" label="Home" icon="home" active={active === "home"} />
          <ScreenLink
            to="/companies"
            label="Companies"
            icon="companies"
            active={active === "companies"}
          />
          {companyScreens.map((screen) =>
            ticker === null ? (
              <button
                key={screen.path}
                type="button"
                onClick={() => void navigate({ to: "/companies" })}
                aria-label={`${screen.name}: choose a company first`}
                data-label={`${screen.name}: choose a company first`}
              >
                <Icon name={screen.icon} />
              </button>
            ) : (
              <ScreenLink
                key={screen.path}
                to={`/$ticker/${screen.path}`}
                label={screen.name}
                icon={screen.icon}
                active={active === screen.path}
                ticker={ticker}
                year={year}
              />
            ),
          )}
          <ScreenLink
            to="/glossary"
            label="Glossary"
            icon="glossary"
            active={active === "glossary"}
          />
        </nav>
        <button
          type="button"
          onClick={openPalette}
          aria-label="Switch company"
          data-label="Switch company ⌘K"
        >
          <Icon name="search" />
        </button>
      </div>
    </>
  );
}

// One content width and one pair of side margins on every screen. Sections
// settle in one after another on arrival.
export function Screen({
  active,
  children,
  className = "",
}: {
  readonly active: ScreenName;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <>
      <main className={`page settle ${className}`}>{children}</main>
      <BottomBar active={active} />
    </>
  );
}
