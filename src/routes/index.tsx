import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { companiesQuery, findCompanyIn, type NamedCompany } from "../functions/companies";
import { allTerms, type GlossaryTerm } from "../glossary/glossary";
import { LogoTile, plainName, shortName } from "../ui/logo-tile";
import { useMounted, useStill } from "../ui/motion";
import { CityPhoto } from "../ui/city-photo";
import { readRecentTickers } from "../ui/last-company";
import type { CompanyScreen } from "../ui/palette";

export const Route = createFileRoute("/")({ component: Home });

const examples = [
  "Where does Costco's money go?",
  "Is Apple growing?",
  "What did Microsoft do with its cash?",
  "What is gross profit?",
  "Apple's balance sheet in 2020",
];
const resting = "Ask about a company, a number or a word";

// The home screen offers only a few ready companies: the ones read most
// recently, then the rest in the order of the list. Companies has them all.
const offered = 3;

const termWords = [
  ...new Set(allTerms.flatMap((term) => term.name.toLowerCase().split(/[^a-z]+/))),
].filter((word) => word.length >= 3);
const byLength = [...allTerms].sort((a, b) => b.name.length - a.name.length);

const findTerm = (text: string) => {
  const lower = text.toLowerCase();
  return (
    byLength.find((term) =>
      new RegExp(
        `(^|[^a-z])${term.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?([^a-z]|$)`,
      ).test(lower),
    ) ?? null
  );
};

type Destination = {
  screen: CompanyScreen;
  label: string;
  tab?: "balance" | "cash";
};

// Which screen a question is about, from its words and the term it names.
const screenFor = (text: string, term: GlossaryTerm | null): Destination => {
  const lower = text.toLowerCase();
  if (
    /balance sheet|assets|liabilit|debt|cash flow|statement/.test(lower) ||
    (term !== null && term.section >= 5 && term.section <= 6)
  ) {
    const cash = /cash flow|capital expenditure|free cash/.test(lower) || term?.section === 6;
    const balance = /balance|asset|liabilit|equity|debt|cash\b/.test(lower) || term?.section === 5;
    return {
      screen: "statements",
      label: "the statements",
      ...(cash ? { tab: "cash" } : balance ? { tab: "balance" } : {}),
    };
  }
  if (
    /money go|spend|spent|each dollar|where does|cost|margin|keep|kept/.test(lower) ||
    term?.section === 4
  ) {
    return { screen: "where-the-money-goes", label: "where the money goes" };
  }
  if (
    /happen|timeline|history|event|buyback|dividend|acquisi|interest rate|inflation|recession|do with/.test(
      lower,
    ) ||
    (term !== null && term.section >= 9 && term.section <= 10)
  ) {
    return { screen: "timeline", label: "the timeline" };
  }
  return { screen: "overview", label: "the overview" };
};

const isQuestion = (text: string) =>
  /\?\s*$|^(is|are|does|do|did|has|have|how|why|where|what|which|when|can|should|could|will)\b/i.test(
    text,
  );

type Understood =
  | { kind: "term"; term: GlossaryTerm; say: ReactNode }
  | {
      kind: "screen";
      company: NamedCompany;
      destination: Destination;
      year: number | null;
      say: ReactNode;
    }
  | { kind: "ask"; company: NamedCompany; say: ReactNode }
  | { kind: "collect"; company: NamedCompany; say: ReactNode }
  | { kind: "nothing"; say: ReactNode };

function Home() {
  const navigate = useNavigate();
  const still = useStill();
  const [text, setText] = useState("");
  const [placeholder, setPlaceholder] = useState(resting);
  const ask = useRef<HTMLTextAreaElement>(null);
  const { data: companies } = useQuery(companiesQuery);
  const mounted = useMounted();
  const ready = (companies?.companies ?? []).filter((company) => company.state === "ready");
  const recent = mounted ? readRecentTickers() : [];
  const rank = (ticker: string) => {
    const at = recent.indexOf(ticker);
    return at === -1 ? recent.length : at;
  };
  const shownCompanies = ready
    .map((company, position) => ({ company, position }))
    .sort((a, b) => rank(a.company.ticker) - rank(b.company.ticker) || a.position - b.position)
    .slice(0, offered)
    .map(({ company }) => company);
  const trimmed = text.trim();
  const term = findTerm(trimmed);
  const asksMeaning =
    /^(what('s| is| are| does)|define|meaning of|explain)\b/i.test(trimmed) && term !== null;
  const { data: named, isFetching } = useQuery({
    queryKey: ["home", "company", trimmed],
    queryFn: () => findCompanyIn({ data: { text: trimmed, skip: termWords } }),
    enabled: trimmed.length >= 2 && !asksMeaning,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const company = asksMeaning || trimmed === "" ? null : (named ?? null);

  useEffect(() => {
    document.title = "Follow the money";
  }, []);

  const yearMatch = /\b(20[0-4]\d)\b/.exec(trimmed);
  const understood: Understood | null =
    trimmed === ""
      ? null
      : term !== null && (company === null || asksMeaning)
        ? {
            kind: "term",
            term,
            say: (
              <>
                Opens <strong>{term.name}</strong> in the glossary
              </>
            ),
          }
        : company !== null && company.state === "ready" && isQuestion(trimmed)
          ? {
              kind: "ask",
              company,
              say: (
                <>
                  Asks ChatGPT about <strong>{shortName(company.name)}</strong>
                </>
              ),
            }
          : company !== null && company.state === "ready"
            ? (() => {
                const destination = screenFor(trimmed, term);
                const year = yearMatch === null ? null : Number(yearMatch[1]);
                return {
                  kind: "screen" as const,
                  company,
                  destination,
                  year,
                  say: (
                    <>
                      Opens <strong>{shortName(company.name)}</strong>, {destination.label}
                      {year === null ? "" : `, fiscal ${year}`}
                    </>
                  ),
                };
              })()
            : company !== null
              ? {
                  kind: "collect",
                  company,
                  say: (
                    <>
                      <strong>{plainName(company.name)}</strong> is not collected yet. Opens
                      Companies to collect it
                    </>
                  ),
                }
              : isFetching
                ? null
                : {
                    kind: "nothing",
                    say: "Try a company, a ticker or a word from the glossary",
                  };

  const go = () => {
    if (understood === null) return;
    if (understood.kind === "term") window.location.assign(`/glossary#${understood.term.slug}`);
    else if (understood.kind === "screen") {
      void navigate({
        to: `/$ticker/${understood.destination.screen}`,
        params: { ticker: understood.company.ticker },
        search: {
          ...(understood.year === null ? {} : { year: understood.year }),
          ...(understood.destination.tab === undefined ? {} : { tab: understood.destination.tab }),
        },
      });
    } else if (understood.kind === "ask") {
      void navigate({
        to: "/$ticker/ask",
        params: { ticker: understood.company.ticker },
        search: { q: trimmed },
      });
    } else if (understood.kind === "collect") {
      void navigate({
        to: "/companies",
        search: { find: understood.company.ticker },
      });
    }
  };

  // Grows with what is typed, up to a few lines.
  useEffect(() => {
    const element = ask.current;
    if (element === null) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [text]);

  // The placeholder types real examples, one after another, until you type.
  useEffect(() => {
    if (still) {
      setPlaceholder(resting);
      return;
    }
    let which = 0;
    let shown = 0;
    let typing = true;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (ask.current?.value) {
        setPlaceholder(resting);
        timer = setTimeout(step, 600);
        return;
      }
      const example = examples[which]!;
      if (typing) {
        shown += 1;
        setPlaceholder(example.slice(0, shown));
        if (shown === example.length) {
          typing = false;
          timer = setTimeout(step, 1800);
          return;
        }
        timer = setTimeout(step, 42 + Math.random() * 40);
        return;
      }
      shown -= 2;
      setPlaceholder(example.slice(0, Math.max(0, shown)));
      if (shown <= 0) {
        typing = true;
        shown = 0;
        which = (which + 1) % examples.length;
        timer = setTimeout(step, 350);
        return;
      }
      timer = setTimeout(step, 18);
    };
    timer = setTimeout(step, 1300);
    return () => clearTimeout(timer);
  }, [still]);

  // Start typing straight away, and "/" comes back to the box.
  useEffect(() => {
    const focus = setTimeout(() => ask.current?.focus({ preventScroll: true }), still ? 0 : 1100);
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        document.activeElement !== ask.current &&
        !(event.target as Element | null)?.closest("input, textarea")
      ) {
        event.preventDefault();
        ask.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focus);
      window.removeEventListener("keydown", onKey);
    };
  }, [still]);

  const canGo = understood !== null && understood.kind !== "nothing";

  return (
    <div className="home-root">
      <CityPhoto />
      <main className="home">
        <div className="home-hero">
          <h1 className="visually-hidden">Follow the money</h1>
          <form
            className="composer"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              go();
            }}
          >
            <label className="visually-hidden" htmlFor="ask">
              What do you want to understand?
            </label>
            <textarea
              id="ask"
              ref={ask}
              rows={1}
              placeholder={placeholder}
              spellCheck={false}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  go();
                }
              }}
            />
            <div className="tools">
              <div className="chips" role="group" aria-label="Examples">
                {examples
                  .slice(0, 2)
                  .concat(examples[3]!)
                  .map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="chip"
                      onClick={() => {
                        setText(example);
                        ask.current?.focus();
                      }}
                    >
                      {example}
                    </button>
                  ))}
              </div>
              <button type="submit" className="send" aria-label="Open it" disabled={!canGo}>
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 2.2 13.4 7.6l-1.2 1.2L8.9 5.5V14H7.1V5.5L3.8 8.8 2.6 7.6Z" />
                </svg>
              </button>
            </div>
          </form>
          <p className="intent" role="status" aria-live="polite">
            {understood !== null && (
              <>
                {canGo && <kbd>{"↵"}</kbd>}
                <span>{understood.say}</span>
              </>
            )}
          </p>
          {ready.length > 0 && (
            <div className="ready-list" aria-label="Ready companies">
              {shownCompanies.map((each) => (
                <Link
                  key={each.cik}
                  to="/$ticker/overview"
                  params={{ ticker: each.ticker }}
                  search={each.latestFiscalYear === null ? {} : { year: each.latestFiscalYear }}
                >
                  <LogoTile name={plainName(each.name)} cik={each.cik} size={32} />
                  {each.ticker}
                  <span>{shortName(each.name)}</span>
                </Link>
              ))}
              {ready.length > offered && (
                <Link to="/companies" className="all-companies">
                  All {ready.length} companies
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
