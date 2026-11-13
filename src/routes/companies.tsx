import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  type CompanyMatch,
  collectCompany,
  companiesQuery,
  fetchCompanyList,
  type ListedCompany,
  saveContact,
  searchQuery,
  summariesQuery,
} from "../functions/companies";
import { useAskToCollect } from "../ui/collect-dialog";
import { CollectProgress } from "../ui/collect-progress";
import { Icon } from "../ui/icons";
import { LogoTile, plainName } from "../ui/logo-tile";
import {
  type Order,
  ReadyTable,
  type SortKey,
  type TableView,
  defaultView,
  firstOrder,
  sortKeys,
} from "../ui/ready-table";
import { RemoveButton } from "../ui/remove-company";
import { Screen } from "../ui/screen";
import { OwnFigures, Term } from "../ui/term";

type CompaniesSearch = {
  readonly find?: string;
  readonly sort?: SortKey;
  readonly order?: Order;
  readonly per?: 100;
};

const isSortKey = (value: unknown): value is SortKey =>
  typeof value === "string" && (sortKeys as ReadonlyArray<string>).includes(value);

const readyCiks = (companies: ReadonlyArray<ListedCompany>) =>
  companies.filter((company) => company.state === "ready").map((company) => company.cik);

// How the ready companies are sorted and shown lives in the address bar, and
// is left out of it while it is the default.
const viewOf = (search: CompaniesSearch): TableView => {
  const sort = search.sort ?? defaultView.sort;
  return {
    sort,
    order: search.order ?? firstOrder(sort),
    units: search.per === 100 ? "per100" : "dollars",
  };
};

const searchOf = (find: string | undefined, view: TableView): CompaniesSearch => ({
  ...(find === undefined ? {} : { find }),
  ...(view.sort === defaultView.sort ? {} : { sort: view.sort }),
  ...(view.order === firstOrder(view.sort) ? {} : { order: view.order }),
  ...(view.units === "per100" ? { per: 100 as const } : {}),
});

export const Route = createFileRoute("/companies")({
  validateSearch: (search: Record<string, unknown>): CompaniesSearch => ({
    ...(typeof search.find === "string" && search.find !== "" ? { find: search.find } : {}),
    ...(isSortKey(search.sort) ? { sort: search.sort } : {}),
    ...(search.order === "asc" || search.order === "desc" ? { order: search.order } : {}),
    ...(Number(search.per) === 100 ? { per: 100 as const } : {}),
  }),
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(companiesQuery);
    await context.queryClient.ensureQueryData(summariesQuery(readyCiks(data.companies)));
  },
  component: CompaniesPage,
});

const noFigures = () => null;

function CompaniesPage() {
  const { data } = useSuspenseQuery(companiesQuery);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/companies" });
  const ready = data.companies
    .filter((company) => company.state === "ready")
    .sort((a, b) => a.name.localeCompare(b.name));
  const line = data.companies.filter(
    (company) => company.state === "waiting" || company.state === "collecting",
  );
  const failed = data.companies.filter((company) => company.state === "failed");
  const nothingYet = ready.length === 0 && line.length === 0 && failed.length === 0;

  useEffect(() => {
    document.title = "Companies";
  }, []);

  return (
    <OwnFigures figure={noFigures}>
      <Screen active="companies">
        <div>
          <h1 className="m-0 mb-2 text-xl font-semibold tracking-[-0.01em]">Companies</h1>
          <p className="m-0 mb-6 max-w-[62ch] text-text-2">
            {data.known > 0
              ? `Search covers all ${data.known.toLocaleString("en-US")} public companies on the SEC's list. A company is collected only when you ask for it.`
              : "Search covers every public company on the SEC's list. A company is collected only when you ask for it."}
          </p>
          {data.known > 0 ? (
            <Finder line={line} />
          ) : (
            <FirstList contactGiven={data.contact !== null} />
          )}
        </div>
        {nothingYet && data.known > 0 && <Welcome />}
        {line.length > 0 && (
          <section className="mt-12" aria-labelledby="working-title">
            <h2 id="working-title" className="m-0 mb-3 text-m font-semibold">
              <Term name="Collecting" />
              <span className="ml-1.5 font-normal text-text-3">{line.length}</span>
            </h2>
            <ul className="rows">
              {line.map((company, index) => (
                <li key={company.cik} className="progress-row" data-cik={company.cik} tabIndex={-1}>
                  <LogoTile name={plainName(company.name)} cik={company.cik} size={44} />
                  <div className="row-main">
                    <div className="row-title">
                      <strong>{plainName(company.name)}</strong>
                      <span className="ticker">{company.ticker}</span>
                    </div>
                    <CollectProgress
                      name={plainName(company.name)}
                      state={
                        index === 0 && company.state === "collecting" ? "collecting" : "waiting"
                      }
                      step={company.collectStep}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {failed.length > 0 && <Failed companies={failed} />}
        {ready.length > 0 && (
          <ReadyTable
            companies={ready}
            view={viewOf(search)}
            onView={(view) =>
              void navigate({
                search: (previous) => searchOf(previous.find, view),
                replace: true,
                resetScroll: false,
              })
            }
          />
        )}
      </Screen>
    </OwnFigures>
  );
}

function Welcome() {
  const askToCollect = useAskToCollect();
  const suggestions = [
    { cik: 320193, name: "Apple Inc.", ticker: "AAPL" },
    { cik: 909832, name: "Costco Wholesale Corp", ticker: "COST" },
    { cik: 789019, name: "Microsoft Corp", ticker: "MSFT" },
  ];
  return (
    <section className="panel welcome" aria-labelledby="welcome-title">
      <h2 id="welcome-title">Start with one company</h2>
      <p>
        Find any public company by name or ticker. The first time you choose one, the tool collects
        its filings from the SEC and keeps them on this computer. After that it opens straight away.
      </p>
      <ol className="steps">
        <li>
          <span>
            <strong>Find it</strong>by name or ticker, such as Costco or COST.
          </span>
        </li>
        <li>
          <span>
            <strong>Agree to collect it</strong>and keep reading while it runs.
          </span>
        </li>
        <li>
          <span>
            <strong>Open it</strong>when it is ready, usually within seconds.
          </span>
        </li>
      </ol>
      <p className="suggest-label" id="suggest-label">
        Good first companies
      </p>
      <div className="suggest" role="group" aria-labelledby="suggest-label">
        {suggestions.map((company) => (
          <button
            key={company.cik}
            type="button"
            onClick={() => askToCollect(company, { open: true })}
          >
            <LogoTile name={company.name} cik={company.cik} size={32} />
            <span>{company.name}</span>
            <span className="ticker">{company.ticker}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// Before anything else the tool needs the SEC's list of companies, and the
// SEC asks for contact details before it answers.
function FirstList({ contactGiven }: { readonly contactGiven: boolean }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fetchList = async () => {
    setProblem(null);
    if (!contactGiven && (name.trim() === "" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      setProblem("Enter your name and an email address, such as name@example.com.");
      return;
    }
    setBusy(true);
    try {
      if (!contactGiven) {
        await saveContact({ data: { name: name.trim(), email: email.trim() } });
      }
      const answer = await fetchCompanyList();
      if (!answer.ok) setProblem(answer.reason);
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch {
      setProblem("The tool could not fetch the list. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel welcome mt-0" aria-labelledby="first-title">
      <h2 id="first-title">First, the list of public companies</h2>
      <p>
        To search every public company, the tool fetches the SEC's list of names and tickers once.
        {contactGiven
          ? ""
          : " The SEC asks every program that fetches its data to name the person sending the requests, so these go only to the SEC and stay on this computer."}
      </p>
      <form
        className="mt-5 grid max-w-[460px] gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void fetchList();
        }}
      >
        {!contactGiven && (
          <>
            <div className="field">
              <label htmlFor="first-name">Name</label>
              <input
                id="first-name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="first-email">Email</label>
              <input
                id="first-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </>
        )}
        {problem !== null && (
          <p className="field-message" role="alert">
            {problem}
          </p>
        )}
        <div>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Fetching the list" : "Fetch the list"}
          </button>
        </div>
      </form>
    </section>
  );
}

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

function Finder({ line }: { readonly line: ReadonlyArray<ListedCompany> }) {
  const search = Route.useSearch();
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

function Failed({ companies }: { readonly companies: ReadonlyArray<ListedCompany> }) {
  const queryClient = useQueryClient();
  const [problems, setProblems] = useState<Readonly<Record<number, string>>>({});
  const tryAgain = async (cik: number) => {
    setProblems((was) =>
      Object.fromEntries(Object.entries(was).filter(([key]) => Number(key) !== cik)),
    );
    try {
      const answer = await collectCompany({ data: { cik } });
      if (answer.answer === "not covered" || answer.answer === "could not ask") {
        setProblems((was) => ({ ...was, [cik]: answer.reason }));
      }
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch {
      setProblems((was) => ({
        ...was,
        [cik]: "The tool could not start collecting. Try again in a moment.",
      }));
    }
  };
  return (
    <section className="mt-12" aria-labelledby="failed-title">
      <h2 id="failed-title" className="m-0 mb-3 text-m font-semibold">
        Could not be collected
        <span className="ml-1.5 font-normal text-text-3">{companies.length}</span>
      </h2>
      <ul className="rows">
        {companies.map((company) => (
          <li key={company.cik} data-cik={company.cik} tabIndex={-1}>
            <LogoTile name={plainName(company.name)} cik={company.cik} size={44} />
            <div className="row-main">
              <div className="row-title">
                <strong>{plainName(company.name)}</strong>
                <span className="ticker">{company.ticker}</span>
              </div>
              <div className="text-xs text-text-2" role="status">
                {problems[company.cik] ?? company.failureReason}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="quiet-button"
                onClick={() => void tryAgain(company.cik)}
              >
                Try again
              </button>
              <RemoveButton company={company} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
