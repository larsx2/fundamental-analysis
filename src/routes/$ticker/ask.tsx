import { Link, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KnownFigure } from "../../shared/answer-figures";
import { AnswerText, termsToLink, uncheckedIn } from "../../ui/ask/answer-text";
import { DrawingPanel } from "../../ui/ask/drawing";
import { type LookupRead, useAsk } from "../../ui/ask/use-ask";
import { useReadyCompany } from "../../ui/company-frame";
import { CompanyHeader } from "../../ui/company-header";
import { longDate } from "../../ui/format";
import { plainName, shortName } from "../../ui/logo-tile";
import { ownFigureLine } from "../../ui/own-figure";
import type { CompanyScreen } from "../../ui/palette";
import { Screen } from "../../ui/screen";
import { OwnFigures } from "../../ui/term";

declare module "@tanstack/history" {
  interface HistoryState {
    asked?: boolean;
  }
}

export const Route = createFileRoute("/$ticker/ask")({
  validateSearch: (search: Record<string, unknown>): { q?: string | undefined } =>
    typeof search.q === "string" && search.q.trim() !== "" ? { q: search.q.trim() } : {},
  component: Ask,
});

const readingNames: Record<string, string> = {
  company: "The company",
  trend: "Figures across fiscal years",
  dollar: "Where each dollar went",
  cash: "Net income and free cash flow",
  balance: "The balance sheet",
  uses_of_cash: "Uses of cash",
  returns: "Operating income, debt and equity",
  context: "The economy and corporate events",
  marks: "Marks on every figure",
  glossary: "The glossary",
};

const screenFor: Record<string, { readonly path: CompanyScreen; readonly name: string }> = {
  company: { path: "overview", name: "The Overview" },
  trend: { path: "overview", name: "The Overview" },
  dollar: { path: "where-the-money-goes", name: "Where the money goes" },
  cash: { path: "statements", name: "The Statements" },
  balance: { path: "statements", name: "The Statements" },
  returns: { path: "statements", name: "The Statements" },
  marks: { path: "statements", name: "The Statements" },
  uses_of_cash: { path: "timeline", name: "The Timeline" },
  context: { path: "timeline", name: "The Timeline" },
};

const stateIcon = {
  reading: <path d="M12 4a8 8 0 1 1-8 8" />,
  read: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
    </>
  ),
  failed: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
};

function Ask() {
  const { ticker } = Route.useParams();
  const { q } = Route.useSearch();
  const question = q ?? "";
  const { view, year } = useReadyCompany(ticker, undefined);
  const name = shortName(view.name);
  const asked = useLocation({ select: (location) => location.state.asked === true });
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const run = asked || confirmed === question;
  const state = useAsk(view.ticker, run ? question : "");
  const [lit, setLit] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${plainName(view.name)}: ${question === "" ? "ask" : question}`;
  }, [view.name, question]);

  const ownFigure = useCallback(
    (termName: string) => ownFigureLine({ termName, year, cik: view.cik, companyName: name }),
    [year, view.cik, name],
  );

  const known: ReadonlyArray<KnownFigure> = state.lookups.flatMap((read) =>
    read.result === null
      ? []
      : Object.values(read.result.figures).map((text) => ({
          text,
          source: read.id,
        })),
  );
  const answer = state.answer;
  const drawn =
    answer === null || answer.drawing === null
      ? undefined
      : state.lookups.findLast(
          (read) => read.lookup === answer.drawing && read.result?.drawing != null,
        );
  const screen = drawn === undefined ? undefined : screenFor[drawn.lookup];
  const linked = answer === null ? [] : termsToLink([answer.lead, ...answer.sentences]);
  const unchecked = answer === null ? 0 : uncheckedIn([answer.lead, ...answer.sentences], known);
  const filings = [
    ...new Map(
      state.lookups
        .flatMap((read) => read.result?.filings ?? [])
        .map((filing) => [filing.url, filing] as const),
    ).values(),
  ].sort((a, b) => b.filedOn.localeCompare(a.filedOn));
  const working = run && question !== "" && answer === null && state.failure === null;

  return (
    <OwnFigures figure={ownFigure}>
      <Screen active="ask">
        <CompanyHeader cik={view.cik} name={view.name} ticker={view.ticker} asOf={view.asOf} />
        <div className="ask-layout">
          <article className="ask-answer" aria-live="polite" aria-busy={working}>
            {question === "" ? (
              <h2 className="ask-question">Ask about {name}</h2>
            ) : (
              <>
                <div className="eyebrow">You asked</div>
                <h2 className="ask-question">{question}</h2>
              </>
            )}
            {question !== "" && !run && (
              <section className="panel panel-pad ask-failure">
                <h3>This question came from a link</h3>
                <p>
                  Asking it uses your ChatGPT subscription and sends the question to OpenAI. Ask it
                  only if you meant to.
                </p>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => setConfirmed(question)}
                >
                  Ask it
                </button>
              </section>
            )}
            {working && <p className="ask-waiting">Reading {name}'s figures</p>}
            {state.failure !== null && (
              <Failure
                signedOut={state.failure.signedOut}
                message={state.failure.message}
                name={name}
              />
            )}
            {answer !== null && (
              <>
                <p className="ask-lead">
                  <AnswerText
                    text={answer.lead}
                    known={known}
                    linked={linked[0] ?? new Set()}
                    lit={lit}
                    onLight={setLit}
                  />
                </p>
                {answer.sentences.map((sentence, index) => (
                  <p key={sentence} className="sentence ask-sentence">
                    <AnswerText
                      text={sentence}
                      known={known}
                      linked={linked[index + 1] ?? new Set()}
                      lit={lit}
                      onLight={setLit}
                    />
                  </p>
                ))}
                {drawn?.result?.drawing != null && (
                  <DrawingPanel
                    drawing={drawn.result.drawing}
                    link={
                      screen === undefined ? null : (
                        <Link
                          className="more-link"
                          to={`/$ticker/${screen.path}`}
                          params={{ ticker: view.ticker }}
                        >
                          {screen.name} →
                        </Link>
                      )
                    }
                  />
                )}
                {answer.next.length > 0 && (
                  <nav className="next" aria-label="Ask next">
                    {answer.next.map((next) => (
                      <Link
                        key={next}
                        to="/$ticker/ask"
                        params={{ ticker: view.ticker }}
                        search={{ q: next }}
                        state={{ asked: true }}
                      >
                        {next}
                        <span aria-hidden="true">→</span>
                      </Link>
                    ))}
                  </nav>
                )}
              </>
            )}
            <Composer ticker={view.ticker} name={name} />
            {answer !== null && (
              <p className="ask-foot">
                Answered with your ChatGPT subscription, through Codex on this computer. Your
                question and the figures it looked up went to OpenAI; the database stayed here.
                {unchecked > 0 &&
                  ` ${unchecked === 1 ? "One number" : `${unchecked} numbers`} in this answer did not come from a lookup and ${unchecked === 1 ? "is" : "are"} marked.`}
              </p>
            )}
          </article>
          {question !== "" && (
            <aside className="ask-sources" aria-labelledby="read-title">
              <h2 className="eyebrow" id="read-title">
                What it read
              </h2>
              {state.lookups.length === 0 && working && (
                <p className="ask-sources-empty">Starting</p>
              )}
              <ul className="ask-read">
                {state.lookups.map((read) => (
                  <Read key={read.id} read={read} lit={lit === read.id} onLight={setLit} />
                ))}
              </ul>
              {filings.length > 0 && (
                <>
                  <h3 className="ask-read-section">Filings the figures come from</h3>
                  <ul className="ask-read">
                    {filings.map((filing) => (
                      <li key={filing.url} data-state="read">
                        <svg
                          className="state"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          aria-hidden="true"
                        >
                          <path d="M7 3h7l4 4v14H7z" />
                          <path d="M14 3v4h4" />
                        </svg>
                        <div>
                          <a href={filing.url} target="_blank" rel="noreferrer">
                            {filing.form}
                          </a>
                          <span>Filed {longDate(filing.filedOn)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </aside>
          )}
        </div>
      </Screen>
    </OwnFigures>
  );
}

function Read({
  read,
  lit,
  onLight,
}: {
  readonly read: LookupRead;
  readonly lit: boolean;
  readonly onLight: (source: string | null) => void;
}) {
  return (
    <li
      data-state={read.status}
      className={lit ? "lit" : ""}
      onMouseEnter={() => onLight(read.id)}
      onMouseLeave={() => onLight(null)}
    >
      <svg
        className="state"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {stateIcon[read.status]}
      </svg>
      <div>
        <strong>{read.result?.title ?? readingNames[read.lookup] ?? read.lookup}</strong>
        <span>
          {read.status === "reading"
            ? "Reading"
            : read.status === "failed"
              ? (read.error ?? "Nothing came back")
              : read.result?.detail}
        </span>
      </div>
    </li>
  );
}

function Failure({
  signedOut,
  message,
  name,
}: {
  readonly signedOut: boolean;
  readonly message: string;
  readonly name: string;
}) {
  if (signedOut) {
    return (
      <section className="panel panel-pad ask-failure">
        <h3>Codex is not signed in to ChatGPT on this computer</h3>
        <p>
          The tool answers through Codex, which comes with it and uses your ChatGPT sign-in. Sign in
          once: in a terminal, in the tool's folder, run <kbd>bunx codex login</kbd> and sign in
          with your ChatGPT account. Then ask again.
        </p>
        <p className="text-text-3">{message}</p>
      </section>
    );
  }
  return (
    <section className="panel panel-pad ask-failure">
      <h3>No answer about {name} this time</h3>
      <p className="text-text-3">{message}</p>
      <button type="button" className="button" onClick={() => window.location.reload()}>
        Ask again
      </button>
    </section>
  );
}

function Composer({ ticker, name }: { readonly ticker: string; readonly name: string }) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const send = () => {
    const question = text.trim();
    if (question === "") return;
    setText("");
    void navigate({
      to: "/$ticker/ask",
      params: { ticker },
      search: { q: question },
      state: { asked: true },
    });
  };

  useEffect(() => {
    const element = box.current;
    if (element === null) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [text]);

  return (
    <form
      className="composer ask-composer"
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label className="visually-hidden" htmlFor="ask-next">
        Ask a question about {name}
      </label>
      <textarea
        id="ask-next"
        ref={box}
        rows={1}
        placeholder={`Ask a question about ${name}`}
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
      />
      <div className="tools ask-tools">
        <button type="submit" className="send" aria-label="Ask" disabled={text.trim() === ""}>
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 2.2 13.4 7.6l-1.2 1.2L8.9 5.5V14H7.1V5.5L3.8 8.8 2.6 7.6Z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
