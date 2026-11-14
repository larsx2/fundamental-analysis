import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { companiesQuery } from "../functions/companies";
import { namedCompanyQuery } from "../ui/ask/named-company";
import { warmAsk } from "../ui/ask/use-ask";
import { RevenueExhibit } from "../ui/home/revenue-exhibit";
import { HomeBackdrop } from "../ui/home/backdrop";
import { companyOf, understand, type Understood, wordsOf } from "../ui/home/understand";
import { plainName, shortName } from "../ui/logo-tile";
import { type Mention, MentionInput } from "../ui/mention-input";
import { Clears, usePrefill } from "../ui/prefill";
import { useStill } from "../ui/motion";

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

const sayFor = (understood: Understood): ReactNode => {
  switch (understood.kind) {
    case "term":
      return (
        <>
          Opens <strong>{understood.term.name}</strong> in the glossary
        </>
      );
    case "ask":
      return (
        <>
          Asks about <strong>{shortName(understood.company.name)}</strong>
        </>
      );
    case "screen":
      return (
        <>
          Opens <strong>{shortName(understood.company.name)}</strong>,{" "}
          {understood.destination.label}
          {understood.year === null ? "" : `, fiscal ${understood.year}`}
        </>
      );
    case "collect":
      return (
        <>
          <strong>{plainName(understood.company.name)}</strong> is not collected yet. Opens
          Companies to collect it
        </>
      );
    case "nothing":
      return "Try a company, a ticker or a word from the glossary";
  }
};

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
  const { term, asksMeaning } = wordsOf(trimmed);
  const { data: named, isFetching } = useQuery({
    ...namedCompanyQuery(trimmed),
    enabled: trimmed.length >= 2 && !asksMeaning && mentioned === undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const company = companyOf(mentioned, ready, named, asksMeaning, trimmed);

  useEffect(() => {
    document.title = "Follow the money";
  }, []);

  const understood = understand({
    trimmed,
    term,
    asksMeaning,
    mentioned: mentioned !== undefined,
    company,
    isFetching,
  });

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
            onFocus={warmAsk}
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
                <span>{sayFor(understood)}</span>
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
