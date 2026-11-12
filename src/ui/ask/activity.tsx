import { useEffect, useState } from "react";
import { inWords, lowerFirst } from "../format";
import { LogoTile, plainName, shortName } from "../logo-tile";
import type { AskState, LookupRead } from "./use-ask";

const termsOf = (input: unknown) =>
  typeof input === "object" && input !== null && "terms" in input && Array.isArray(input.terms)
    ? input.terms.map((term) => lowerFirst(String(term)))
    : [];

const termOf = (input: unknown) =>
  typeof input === "object" && input !== null && "term" in input ? String(input.term) : "a term";

export const lookupPhrase = (name: string, read: Pick<LookupRead, "lookup" | "input">) => {
  switch (read.lookup) {
    case "company":
      return `what ${name} does`;
    case "trend": {
      const terms = termsOf(read.input);
      return terms.length === 0
        ? `${name}'s figures across ten fiscal years`
        : `${name}'s ${inWords(terms)} across ten fiscal years`;
    }
    case "dollar":
      return `${name}'s income statement`;
    case "cash":
      return `${name}'s net income and free cash flow`;
    case "balance":
      return `${name}'s balance sheet`;
    case "uses_of_cash":
      return `what ${name} did with its cash`;
    case "returns":
      return `${name}'s operating income, debt and equity`;
    case "context":
      return `the economy and ${name}'s corporate events`;
    case "marks":
      return `the marks on ${name}'s figures`;
    case "glossary":
      return `the glossary entry for ${termOf(read.input)}`;
    default:
      return read.lookup;
  }
};

const useSeconds = (from: number | null, until: number | null) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (from === null || until !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [from, until]);
  if (from === null) return 0;
  return Math.max(0, Math.round(((until ?? now) - from) / 1000));
};

const seconds = (count: number) => `${count} ${count === 1 ? "second" : "seconds"}`;

function Thought() {
  return (
    <svg
      className="ask-step-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  );
}

type Named = { readonly cik: number; readonly name: string; readonly ticker: string };

const tickerOf = (input: unknown) =>
  typeof input === "object" && input !== null && "ticker" in input
    ? String(input.ticker).toUpperCase()
    : null;

const nameFor = (companies: ReadonlyArray<Named>, read: Pick<LookupRead, "input">) => {
  const ticker = tickerOf(read.input);
  const found = companies.find((company) => company.ticker.toUpperCase() === ticker);
  return shortName((found ?? companies[0])?.name ?? ticker ?? "the company");
};

function Steps({
  state,
  companies,
}: {
  readonly state: AskState;
  readonly companies: ReadonlyArray<Named>;
}) {
  return (
    <ol className="ask-steps">
      {state.steps.map((step) => {
        if (step.kind === "thinking") {
          return (
            <li key={step.id} className="ask-step thought">
              <Thought />
              <span>{step.text}</span>
            </li>
          );
        }
        const read = state.lookups.find((each) => each.id === step.id);
        if (read === undefined) return null;
        const phrase = lookupPhrase(nameFor(companies, read), read);
        return (
          <li key={step.id} className="ask-step lookup" data-state={read.status}>
            <svg
              className="ask-step-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {read.status === "reading" ? (
                <path d="M12 4a8 8 0 1 1-8 8" />
              ) : read.status === "failed" ? (
                <path d="M8 8l8 8M16 8l-8 8" />
              ) : (
                <path d="M6.5 12.5l3.5 3.5 7.5-8" />
              )}
            </svg>
            <span>
              {read.status === "reading"
                ? `Fetching ${phrase}`
                : read.status === "failed"
                  ? `Could not read ${phrase}`
                  : `Read ${phrase}`}
              {read.status === "failed" && read.error !== null && (
                <span className="ask-step-detail">{read.error}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Activity({
  state,
  companies,
}: {
  readonly state: AskState;
  readonly companies: ReadonlyArray<Named>;
}) {
  const elapsed = useSeconds(state.startedAt, state.finishedAt);
  const finished = state.finishedAt !== null;
  const lookups = state.lookups.length;

  if (finished) {
    if (state.steps.length === 0) return null;
    return (
      <details className="ask-activity done">
        <summary>
          {state.failure === null ? "Worked" : "Stopped"} for {seconds(elapsed)}
          {lookups > 0 && ` and read ${lookups} ${lookups === 1 ? "lookup" : "lookups"}`}
        </summary>
        <Steps state={state} companies={companies} />
      </details>
    );
  }

  const fetching = state.lookups.find((each) => each.status === "reading");
  const headline =
    fetching !== undefined
      ? `Fetching ${lookupPhrase(nameFor(companies, fetching), fetching)}`
      : lookups > 0
        ? "Writing the answer"
        : "Working out what to read";

  return (
    <section className="ask-activity" aria-label="What the agent is doing">
      <div className="ask-activity-head">
        {companies.length > 0 && (
          <span className="ask-logos">
            {companies.slice(0, 3).map((company) => (
              <LogoTile
                key={company.cik}
                name={plainName(company.name)}
                cik={company.cik}
                size={28}
              />
            ))}
          </span>
        )}
        <span className="ask-activity-title" role="status">
          {headline}
        </span>
        <span className="ask-activity-time numbers">{seconds(elapsed)}</span>
      </div>
      {state.steps.length > 0 && <Steps state={state} companies={companies} />}
    </section>
  );
}
