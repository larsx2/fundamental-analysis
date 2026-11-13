import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { type CompanyMatch, type ListedCompany, searchQuery } from "../../functions/companies";
import { useAskToCollect } from "../collect-dialog";
import { Icon } from "../icons";
import { LogoTile, plainName } from "../logo-tile";

const stateWord = (state: CompanyMatch["state"]) =>
  state === "ready"
    ? "Ready"
    : state === "collecting"
      ? "Collecting"
      : state === "waiting"
        ? "Waiting"
        : state === "failed"
          ? "Could not be collected"
          : "Not collected";

const actWord = (state: CompanyMatch["state"]) =>
  state === "ready" ? "open" : state === "not_collected" || state === "failed" ? "collect" : "show";

const highlight = (name: string, query: string) => {
  const wanted = query.trim().toLowerCase();
  const at = name.toLowerCase().indexOf(wanted);
  if (wanted === "" || at < 0) return name;
  return (
    <>
      {name.slice(0, at)}
      <mark>{name.slice(at, at + wanted.length)}</mark>
      {name.slice(at + wanted.length)}
    </>
  );
};

const route = getRouteApi("/companies");

export function Finder({ line }: { readonly line: ReadonlyArray<ListedCompany> }) {
  const search = route.useSearch();
  const navigate = useNavigate();
  const askToCollect = useAskToCollect();
  const [text, setText] = useState(search.find ?? "");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const { data: results = [] } = useQuery({
    ...searchQuery(text),
    enabled: text.trim() !== "",
    placeholderData: keepPreviousData,
  });
  const open = text.trim() !== "";
  const shown = open ? results : [];
  const at = Math.min(active, Math.max(0, shown.length - 1));

  useEffect(() => {
    if (search.find !== undefined) input.current?.focus();
  }, [search.find]);

  // The slash key goes to this screen's own search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target as Element | null;
      if (target?.closest("input, textarea, [role=dialog]") != null) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (company: CompanyMatch) => {
    const ticker = company.tickers[0] ?? "";
    if (company.state === "ready") {
      void navigate({
        to: "/$ticker/where-the-money-goes",
        params: { ticker },
      });
    } else if (company.state === "waiting" || company.state === "collecting") {
      const row = document.querySelector<HTMLElement>(`.rows [data-cik="${company.cik}"]`);
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
      row?.focus({ preventScroll: true });
    } else {
      askToCollect({ cik: company.cik, name: company.name }, { open: true });
    }
  };

  const tickerShown = (company: CompanyMatch) => {
    const upper = text.trim().toUpperCase();
    return (
      company.tickers.find((ticker) => ticker === upper) ??
      company.tickers.find((ticker) => upper !== "" && ticker.startsWith(upper)) ??
      company.tickers[0]
    );
  };

  return (
    <div className="finder">
      <div className="find-box">
        <Icon name="search" />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && shown.length > 0}
          aria-controls="results"
          aria-activedescendant={shown[at] === undefined ? undefined : `result-${shown[at].cik}`}
          aria-label="Find a company by name or ticker"
          placeholder="Name or ticker"
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown")
              setActive(shown.length === 0 ? 0 : (at + 1) % shown.length);
            else if (event.key === "ArrowUp")
              setActive(shown.length === 0 ? 0 : (at - 1 + shown.length) % shown.length);
            else if (event.key === "Enter" && shown[at] !== undefined) choose(shown[at]);
            else if (event.key === "Escape" && text !== "") setText("");
            else return;
            event.preventDefault();
          }}
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      {open && (
        <div className="results">
          {shown.length > 0 ? (
            <div id="results" role="listbox" aria-label="Companies found">
              {shown.map((company, index) => {
                const inLine = line.findIndex((each) => each.cik === company.cik);
                const state =
                  inLine > 0 && company.state === "collecting" ? "waiting" : company.state;
                return (
                  <div
                    key={company.cik}
                    className="result"
                    role="option"
                    id={`result-${company.cik}`}
                    aria-selected={index === at}
                    onMouseMove={() => index !== at && setActive(index)}
                    onClick={() => choose(company)}
                  >
                    <LogoTile
                      key={company.state}
                      name={plainName(company.name)}
                      cik={company.cik}
                      size={36}
                    />
                    <span className="result-main">
                      <span className="result-name">
                        {highlight(plainName(company.name), text)}
                      </span>
                      <span className="ticker">{tickerShown(company)}</span>
                    </span>
                    <span className="result-state">
                      <span className={`state-word ${state === "ready" ? "ready" : ""}`}>
                        {stateWord(state)}
                      </span>
                      <span className="act">
                        <kbd>{"↵"}</kbd> {actWord(state)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="results-empty">
              <strong>No public company matches {`“${text.trim()}”`}.</strong>
              Try the ticker, such as COST, or one word of the name.
            </div>
          )}
          {shown.length === 20 && (
            <div className="results-foot">
              The 20 closest matches. Type more of the name to narrow them.
            </div>
          )}
        </div>
      )}
      <p className="visually-hidden" aria-live="polite">
        {open
          ? shown.length > 0
            ? `${shown.length} ${shown.length === 1 ? "company" : "companies"} found.`
            : "No company found."
          : ""}
      </p>
    </div>
  );
}
