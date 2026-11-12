import { Dialog } from "@base-ui/react/dialog";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { companiesQuery } from "../functions/companies";
import { longDate } from "./format";
import { Icon, type IconName } from "./icons";
import { LogoTile, plainName } from "./logo-tile";

export const companyScreens = [
  { path: "overview", name: "Overview", icon: "overview" },
  { path: "where-the-money-goes", name: "Where the money goes", icon: "money" },
  { path: "statements", name: "Statements", icon: "statements" },
  { path: "timeline", name: "Timeline", icon: "timeline" },
] as const satisfies ReadonlyArray<{
  path: string;
  name: string;
  icon: IconName;
}>;

export type CompanyScreen = (typeof companyScreens)[number]["path"];

const PaletteContext = createContext<() => void>(() => {});

export const useOpenPalette = () => useContext(PaletteContext);

// Where the person is now: the company shown, the screen and the fiscal year.
export const useHere = () =>
  useRouterState({
    select: (state) => {
      const [first = "", second = ""] = state.location.pathname.split("/").filter(Boolean);
      const reserved = new Set(["companies", "glossary"]);
      const ticker = first !== "" && !reserved.has(first) ? decodeURIComponent(first) : null;
      const screen = companyScreens.find((each) => each.path === second)?.path ?? null;
      const search = state.location.search as { year?: unknown };
      return {
        ticker,
        screen,
        year: typeof search.year === "number" ? search.year : null,
      };
    },
    structuralSharing: true,
  });

type Item =
  | {
      readonly kind: "company";
      readonly ticker: string;
      readonly name: string;
      readonly asOf: string | null;
    }
  | {
      readonly kind: "screen";
      readonly path: CompanyScreen | "companies";
      readonly name: string;
      readonly icon: IconName;
    };

export function PaletteProvider({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((was) => !was);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <PaletteContext.Provider value={openPalette}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="palette-backdrop" />
          {open && <Palette close={() => setOpen(false)} />}
        </Dialog.Portal>
      </Dialog.Root>
    </PaletteContext.Provider>
  );
}

function Palette({ close }: { readonly close: () => void }) {
  const here = useHere();
  const navigate = useNavigate();
  const { data } = useQuery(companiesQuery);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const ready = useMemo(
    () => (data?.companies ?? []).filter((company) => company.state === "ready"),
    [data],
  );
  const wanted = query.trim().toLowerCase();
  const companies = ready.filter(
    (company) =>
      wanted === "" ||
      company.name.toLowerCase().includes(wanted) ||
      company.ticker.toLowerCase().startsWith(wanted),
  );
  const current = ready.find((company) => company.ticker === here.ticker) ?? null;
  const items: ReadonlyArray<Item> = [
    ...companies.map((company): Item => ({
      kind: "company",
      ticker: company.ticker,
      name: plainName(company.name),
      asOf: company.asOf,
    })),
    ...(wanted === "" && current !== null
      ? [
          ...companyScreens.map((screen): Item => ({
            kind: "screen",
            path: screen.path,
            name: screen.name,
            icon: screen.icon,
          })),
          {
            kind: "screen",
            path: "companies",
            name: "Companies",
            icon: "companies",
          } as const,
        ]
      : []),
  ];
  const at = Math.min(active, Math.max(0, items.length - 1));

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [at]);

  const run = (item: Item | undefined) => {
    if (item === undefined) return;
    close();
    const year = here.year ?? undefined;
    if (item.kind === "company") {
      void navigate({
        to: `/$ticker/${here.screen ?? "where-the-money-goes"}`,
        params: { ticker: item.ticker },
        search: true,
        viewTransition: true,
      });
    } else if (item.path === "companies") {
      void navigate({ to: "/companies" });
    } else if (current !== null) {
      void navigate({
        to: `/$ticker/${item.path}`,
        params: { ticker: current.ticker },
        search: year === undefined ? {} : { year },
      });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") setActive(Math.min(items.length - 1, at + 1));
    else if (event.key === "ArrowUp") setActive(Math.max(0, at - 1));
    else if (event.key === "Enter") run(items[at]);
    else return;
    event.preventDefault();
  };

  let index = -1;
  const option = (item: Item, inner: ReactNode) => {
    index += 1;
    const mine = index;
    return (
      <div
        key={`${item.kind}-${item.kind === "company" ? item.ticker : item.path}`}
        className="palette-option"
        role="option"
        id={`palette-option-${mine}`}
        aria-selected={mine === at}
        onMouseMove={() => mine !== at && setActive(mine)}
        onClick={() => run(item)}
      >
        {inner}
      </div>
    );
  };

  return (
    <Dialog.Popup className="palette" initialFocus={input} aria-label="Find a ready company">
      <div className="palette-input">
        <Icon name="search" />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-autocomplete="list"
          aria-activedescendant={items.length > 0 ? `palette-option-${at}` : undefined}
          placeholder="Find a ready company"
          aria-label="Find a ready company"
          spellCheck={false}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd>esc</kbd>
      </div>
      <div
        className="palette-list"
        id="palette-list"
        role="listbox"
        aria-label="Ready companies and screens"
        ref={list}
      >
        <div className="palette-section" role="presentation">
          Ready companies
        </div>
        {companies.length === 0 ? (
          <div className="palette-empty">
            <strong>
              {wanted === ""
                ? "No company is ready yet."
                : `No ready company matches “${query.trim()}”.`}
            </strong>
            <span>
              Companies that are not collected yet are found and collected from the Companies
              screen.
            </span>
          </div>
        ) : (
          items
            .filter((item) => item.kind === "company")
            .map((item) =>
              item.kind === "company"
                ? option(
                    item,
                    <>
                      <LogoTile name={item.name} size={36} />
                      <span className="palette-main">
                        <strong>{item.name}</strong>
                        <span className="ticker">{item.ticker}</span>
                        {item.ticker === here.ticker && (
                          <span className="palette-current">Shown</span>
                        )}
                      </span>
                      {item.asOf !== null && (
                        <span className="palette-meta">As of {longDate(item.asOf)}</span>
                      )}
                      <kbd className="palette-enter">{"↵"}</kbd>
                    </>,
                  )
                : null,
            )
        )}
        {current !== null && wanted === "" && (
          <>
            <div className="palette-section" role="presentation">
              {plainName(current.name)}
            </div>
            {items
              .filter((item) => item.kind === "screen")
              .map((item) =>
                item.kind === "screen"
                  ? option(
                      item,
                      <>
                        <span className="palette-glyph">
                          <Icon name={item.icon} />
                        </span>
                        <span className="palette-main">{item.name}</span>
                        <kbd className="palette-enter">{"↵"}</kbd>
                      </>,
                    )
                  : null,
              )}
          </>
        )}
      </div>
      <div className="palette-foot">
        <span>
          <kbd>{"↑"}</kbd> <kbd>{"↓"}</kbd> move
        </span>
        <span>
          <kbd>{"↵"}</kbd> open
        </span>
        <span>
          <kbd>esc</kbd> close
        </span>
      </div>
    </Dialog.Popup>
  );
}
