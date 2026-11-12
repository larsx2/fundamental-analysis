import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { companiesQuery, type NamedCompany } from "../functions/companies";
import { namedCompanyQuery } from "../ui/ask/named-company";
import { allTerms, type GlossaryTerm } from "../glossary/glossary";
import { RevenueExhibit } from "../ui/home/revenue-exhibit";
import { HomeBackdrop } from "../ui/home/backdrop";
import { plainName, shortName } from "../ui/logo-tile";
import { type Mention, MentionInput } from "../ui/mention-input";
import { Clears, usePrefill } from "../ui/prefill";
import { useStill } from "../ui/motion";
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
const headline = "Follow the money.";

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
  const [mentions, setMentions] = useState<ReadonlyArray<Mention>>([]);
  const [placeholder, setPlaceholder] = useState(resting);
  const ask = useRef<HTMLDivElement>(null);
  const { data: listed } = useQuery(companiesQuery);
  const ready = (listed?.companies ?? [])
    .filter((each) => each.state === "ready")
    .map((each) => ({ cik: each.cik, ticker: each.ticker, name: each.name }));
  const prefill = usePrefill({ text, mentions }, (next, nextMentions) => {
    setText(next);
    setMentions(nextMentions);
  });
  const mentioned = mentions[0];
  const trimmed = text.trim();
  const term = findTerm(trimmed);
  const asksMeaning =
    /^(what('s| is| are| does)|define|meaning of|explain)\b/i.test(trimmed) && term !== null;
  const { data: named, isFetching } = useQuery({
    ...namedCompanyQuery(trimmed),
    enabled: trimmed.length >= 2 && !asksMeaning && mentioned === undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const company: NamedCompany | null =
    mentioned !== undefined
      ? {
          ...mentioned,
          state: ready.some((each) => each.cik === mentioned.cik) ? "ready" : "not_collected",
        }
      : asksMeaning || trimmed === ""
        ? null
        : (named ?? null);

  useEffect(() => {
    document.title = "Follow the money";
  }, []);

  const yearMatch = /\b(20[0-4]\d)\b/.exec(trimmed);
  const understood: Understood | null =
    trimmed === ""
      ? null
      : term !== null && mentioned === undefined && (company === null || asksMeaning)
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
                  Asks about <strong>{shortName(company.name)}</strong>
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
        state: { asked: true },
      });
    } else if (understood.kind === "collect") {
      void navigate({
        to: "/companies",
        search: { find: understood.company.ticker },
      });
    }
  };

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
      if (ask.current?.textContent) {
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
        !(event.target as Element | null)?.closest("input, textarea, [contenteditable]")
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

  // Example questions name ready companies as chips, so a click gives the same
  // field as typing. With a company set, they are about it; one not collected
  // yet has none.
  const asked = (template: (name: string) => string, about: Mention) => ({
    question: template(shortName(about.name)),
    mentions: [about],
  });
  const preferred = [...ready].sort(
    (a, b) =>
      Number(b.ticker === "COST") - Number(a.ticker === "COST") ||
      Number(b.ticker === "AAPL") - Number(a.ticker === "AAPL"),
  );
  const [firstReady, secondReady] = preferred;
  const suggestions =
    company === null
      ? [
          firstReady === undefined
            ? { question: examples[0]!, mentions: [] }
            : asked((name) => `Where does ${name}'s money go?`, firstReady),
          secondReady === undefined
            ? { question: examples[1]!, mentions: [] }
            : asked((name) => `Is ${name} growing?`, secondReady),
          { question: examples[3]!, mentions: [] },
        ]
      : company.state === "ready"
        ? [
            (name: string) => `Where does ${name}'s money go?`,
            (name: string) => `Is ${name} growing?`,
            (name: string) => `What did ${name} do with its cash?`,
          ].map((template) =>
            asked(template, { cik: company.cik, ticker: company.ticker, name: company.name }),
          )
        : [];

  return (
    <div className="home-root">
      <HomeBackdrop />
      <main className="home">
        <section className="home-intro">
          <h1 className="home-title">
            {headline.split(" ").map((word, index) => (
              <Fragment key={word}>
                {index > 0 && " "}
                <span className="word" style={{ animationDelay: `${0.08 + index * 0.09}s` }}>
                  {word}
                </span>
              </Fragment>
            ))}
          </h1>
          <p className="home-lede">
            Ask about any public company. Every number comes from its own filings.
          </p>
          <form
            className="composer"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              go();
            }}
            onKeyDown={prefill.onKeyDown}
          >
            <MentionInput
              id="ask"
              ref={ask}
              label="What do you want to understand?"
              placeholder={placeholder}
              value={text}
              mentions={mentions}
              companies={ready}
              onChange={(next, nextMentions) => {
                setText(next);
                setMentions(nextMentions);
              }}
              onSubmit={go}
            />
            <div className="tools">
              <div className="chips" role="group" aria-label="Examples">
                {suggestions
                  .filter((suggestion) => suggestion.question !== trimmed)
                  .map((suggestion) => (
                    <button
                      key={suggestion.question}
                      type="button"
                      className="chip"
                      onClick={() => {
                        prefill.fill(suggestion.question, suggestion.mentions);
                        ask.current?.focus();
                      }}
                    >
                      {suggestion.question}
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
                {prefill.pending && <Clears />}
              </>
            )}
          </p>
        </section>
        <RevenueExhibit />
      </main>
    </div>
  );
}
