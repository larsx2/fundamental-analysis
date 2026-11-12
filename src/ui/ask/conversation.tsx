import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { KnownFigure } from "../../shared/answer-figures";
import { longDate } from "../format";
import { plainName, shortName } from "../logo-tile";
import type { CompanyScreen } from "../palette";
import { Screen } from "../screen";
import { Activity } from "./activity";
import { AnswerText, termsToLink, uncheckedIn } from "./answer-text";
import { AskComposer } from "./composer";
import { companiesQuery } from "../../functions/companies";
import { addTurn, type Company, companiesOfTurn, startThread, useThreads } from "./conversations";
import { DrawingPanel } from "./drawing";
import { History } from "./history";
import { namedCompanyQuery } from "./named-company";
import { type AskState, type LookupRead, useAsk } from "./use-ask";

declare module "@tanstack/history" {
  interface HistoryState {
    asked?: boolean;
  }
}

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

const drawnIn = (state: AskState) => {
  const answer = state.answer;
  return answer === null || answer.drawing === null
    ? undefined
    : state.lookups.findLast(
        (read) => read.lookup === answer.drawing && read.result?.drawing != null,
      );
};

const drawingTitle = (state: AskState | undefined) =>
  state === undefined ? null : (drawnIn(state)?.result?.drawing?.title ?? null);

const answerText = (state: AskState) =>
  state.answer === null ? "" : [state.answer.lead, ...state.answer.sentences].join(" ");

const following = { on: true };

export function Conversation({
  start,
  q,
  t,
  c,
}: {
  readonly start: Company | null;
  readonly q: string | undefined;
  readonly t: string | undefined;
  readonly c: ReadonlyArray<string>;
}) {
  const navigate = useNavigate();
  const threads = useThreads();
  const thread = t === undefined ? undefined : threads.find((each) => each.id === t);
  const turns = thread?.turns ?? [];
  const pending = q ?? "";
  const asked = useLocation({ select: (location) => location.state.asked === true });
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const { data: listed } = useQuery(companiesQuery);
  const named = useQuery({
    ...namedCompanyQuery(pending),
    enabled: pending !== "" && c.length === 0,
  });
  const pendingCompanies: ReadonlyArray<Company> =
    c.length > 0
      ? c.map((ticker) => {
          const found = listed?.companies.find(
            (each) => each.ticker.toUpperCase() === ticker.toUpperCase(),
          );
          return found === undefined
            ? { ticker, cik: 0, name: ticker }
            : { ticker: found.ticker, cik: found.cik, name: found.name };
        })
      : named.data?.state === "ready"
        ? [{ ticker: named.data.ticker, cik: named.data.cik, name: named.data.name }]
        : start === null
          ? []
          : [start];
  const placed = pending === "" || (c.length > 0 ? listed !== undefined : !named.isPending);
  const run = pending !== "" && (asked || confirmed === pending) && placed;
  const earlier = turns
    .slice(-6)
    .map((turn) => ({ question: turn.question, answer: answerText(turn.state) }));
  const live = useAsk(
    pendingCompanies.map((each) => each.ticker),
    run ? pending : "",
    null,
    earlier,
  );
  const [lit, setLit] = useState<string | null>(null);
  const saved = useRef<string | null>(null);
  const article = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = pending !== "" ? pending : (turns[0]?.question ?? "Ask");
  }, [pending, turns]);

  useEffect(() => {
    if (pending === "" && t !== undefined && start !== null) {
      void navigate({ to: "/ask", search: { t }, replace: true });
    }
  }, [pending, t, start, navigate]);

  useEffect(() => {
    following.on = true;
  }, [pending, t]);

  useEffect(() => {
    const leave = () => {
      const gap = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      following.on = gap < 80;
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) following.on = false;
      else requestAnimationFrame(leave);
    };
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "PageUp", "Home"].includes(event.key)) following.on = false;
    };
    const onTouch = () => requestAnimationFrame(leave);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", onTouch, { passive: true });
    const element = article.current;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const follow = new ResizeObserver(() => {
      if (!following.on) return;
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: still ? "auto" : "smooth",
      });
    });
    if (element !== null) follow.observe(element);
    return () => {
      follow.disconnect();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  useEffect(() => {
    const done = live.state;
    if (!run || done.answer === null || done.startedAt === null) return;
    const mark = `${pending}|${done.startedAt}`;
    if (saved.current === mark) return;
    saved.current = mark;
    const first = pendingCompanies[0];
    const turn = {
      id: crypto.randomUUID(),
      question: pending,
      year: null,
      askedAt: done.startedAt,
      state: done,
      companies: pendingCompanies,
    };
    const threadId = thread?.id ?? crypto.randomUUID();
    if (thread === undefined) {
      startThread({
        id: threadId,
        ticker: first?.ticker ?? null,
        cik: first?.cik ?? null,
        name: first?.name ?? null,
        turns: [turn],
      });
    } else {
      addTurn(thread.id, turn);
    }
    void navigate({ to: "/ask", search: { t: threadId }, replace: true, resetScroll: false });
  }, [run, live.state, pending, thread, pendingCompanies, navigate]);

  const working =
    run && live.state.answer === null && live.state.failure === null && !live.state.stopped;
  const latest =
    pending !== "" && live.state.lookups.length > 0
      ? { id: "live", state: live.state }
      : turns.length > 0
        ? { id: turns.at(-1)!.id, state: turns.at(-1)!.state }
        : { id: "live", state: live.state };
  const filings = [
    ...new Map(
      latest.state.lookups
        .flatMap((read) => read.result?.filings ?? [])
        .map((filing) => [filing.url, filing] as const),
    ).values(),
  ].sort((a, b) => b.filedOn.localeCompare(a.filedOn));
  const lastTurn = turns.at(-1);
  const context =
    lastTurn !== undefined ? companiesOfTurn(lastTurn) : start === null ? [] : [start];
  const name = start === null ? null : shortName(start.name);

  return (
    <Screen active="ask" className="ask-page" settle={false}>
      <h1 className="visually-hidden">
        {start === null ? "Ask" : `Ask about ${plainName(start.name)}`}
      </h1>
      <div className="ask-layout">
        <History threads={threads} current={thread?.id ?? null} />
        <article ref={article} className="ask-answer" aria-live="polite" aria-busy={working}>
          <div key={thread?.id ?? "new"} className="ask-thread">
            {turns.length === 0 && pending === "" && (
              <header className="ask-empty">
                <h2 className="ask-question">
                  {name === null ? "What do you want to understand?" : `Ask about ${name}`}
                </h2>
                <p className="ask-foot">
                  Answers use your own subscription from this computer. Your question and the
                  figures it reads are sent to be answered; the database stays here.
                </p>
              </header>
            )}
            {turns.map((turn, index) => {
              const about = companiesOfTurn(turn);
              return (
                <TurnView
                  key={turn.id}
                  id={turn.id}
                  question={turn.question}
                  state={turn.state}
                  last={pending === "" && index === turns.length - 1}
                  shownBefore={drawingTitle(turns[index - 1]?.state)}
                  companies={about}
                  threadId={thread?.id ?? null}
                  lit={lit}
                  onLight={setLit}
                  activity={<Activity state={turn.state} companies={about} />}
                />
              );
            })}
            {pending !== "" && (
              <TurnView
                id="live"
                question={pending}
                state={live.state}
                last
                shownBefore={drawingTitle(turns.at(-1)?.state)}
                companies={pendingCompanies}
                threadId={thread?.id ?? null}
                lit={lit}
                onLight={setLit}
                activity={
                  <>
                    {placed && !run && (
                      <section className="panel panel-pad ask-failure">
                        <h3>This question came from a link</h3>
                        <p>
                          Asking it uses your subscription and sends the question off this computer.
                          Ask it only if you meant to.
                        </p>
                        <button
                          type="button"
                          className="button primary"
                          onClick={() => setConfirmed(pending)}
                        >
                          Ask it
                        </button>
                      </section>
                    )}
                    {run && <Activity state={live.state} companies={pendingCompanies} />}
                  </>
                }
              />
            )}
          </div>
          <AskComposer
            context={context}
            working={working}
            onStop={live.stop}
            threadId={thread?.id ?? null}
          />
        </article>
        {latest.state.lookups.length > 0 && (
          <aside className="ask-sources" aria-labelledby="read-title">
            <h2 className="eyebrow" id="read-title">
              What it read
            </h2>
            <ul className="ask-read">
              {latest.state.lookups.map((read) => (
                <Read
                  key={read.id}
                  read={read}
                  lit={lit === `${latest.id}:${read.id}`}
                  onLight={(source) => setLit(source === null ? null : `${latest.id}:${source}`)}
                />
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
  );
}

function TurnView({
  id,
  question,
  state,
  last,
  shownBefore,
  companies,
  threadId,
  lit,
  onLight,
  activity,
}: {
  readonly id: string;
  readonly question: string;
  readonly state: AskState;
  readonly last: boolean;
  readonly shownBefore: string | null;
  readonly companies: ReadonlyArray<Company>;
  readonly threadId: string | null;
  readonly lit: string | null;
  readonly onLight: (source: string | null) => void;
  readonly activity: ReactNode;
}) {
  const known: ReadonlyArray<KnownFigure> = state.lookups.flatMap((read) =>
    read.result === null
      ? []
      : Object.values(read.result.figures).map((text) => ({ text, source: `${id}:${read.id}` })),
  );
  const answer = state.answer;
  const found = drawnIn(state);
  const drawn = found?.result?.drawing?.title === shownBefore ? undefined : found;
  const screen = drawn === undefined ? undefined : screenFor[drawn.lookup];
  const drawnTicker =
    drawn !== undefined &&
    typeof drawn.input === "object" &&
    drawn.input !== null &&
    "ticker" in drawn.input
      ? String(drawn.input.ticker).toUpperCase()
      : null;
  const ticker =
    companies.find((each) => each.ticker.toUpperCase() === drawnTicker)?.ticker ??
    companies[0]?.ticker ??
    null;
  const linked = answer === null ? [] : termsToLink([answer.lead, ...answer.sentences]);
  const unchecked = answer === null ? 0 : uncheckedIn([answer.lead, ...answer.sentences], known);
  return (
    <section className="ask-turn" aria-label={question}>
      <h2 className="ask-question">
        <span className="visually-hidden">You asked: </span>
        {question}
      </h2>
      {activity}
      {state.stopped && (
        <section className="panel panel-pad ask-failure">
          <h3>You stopped this answer</h3>
          <p className="text-text-3">Nothing more was sent once you stopped it.</p>
          <button type="button" className="button" onClick={() => window.location.reload()}>
            Ask again
          </button>
        </section>
      )}
      {state.failure !== null && (
        <Failure
          signedOut={state.failure.signedOut}
          message={state.failure.message}
          name={ticker ?? "this"}
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
              onLight={onLight}
            />
          </p>
          {answer.sentences.map((sentence, index) => (
            <p key={sentence} className="sentence ask-sentence">
              <AnswerText
                text={sentence}
                known={known}
                linked={linked[index + 1] ?? new Set()}
                lit={lit}
                onLight={onLight}
              />
            </p>
          ))}
          {drawn?.result?.drawing != null && (
            <DrawingPanel
              drawing={drawn.result.drawing}
              link={
                screen === undefined || ticker === null ? null : (
                  <Link className="more-link" to={`/$ticker/${screen.path}`} params={{ ticker }}>
                    {screen.name} →
                  </Link>
                )
              }
            />
          )}
          {last && answer.next.length > 0 && (
            <nav className="next" aria-label="Ask next">
              <h3 className="eyebrow">Ask next</h3>
              {answer.next.map((next) => (
                <NextQuestion
                  key={next}
                  question={next}
                  tickers={companies.map((each) => each.ticker)}
                  threadId={threadId}
                />
              ))}
            </nav>
          )}
          {unchecked > 0 && (
            <p className="ask-foot">
              {unchecked === 1 ? "One number" : `${unchecked} numbers`} in this answer did not come
              from a lookup and {unchecked === 1 ? "is" : "are"} marked.
            </p>
          )}
        </>
      )}
    </section>
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
        <h3>The assistant is not signed in on this computer</h3>
        <p>
          Sign in once: in a terminal, in the tool's folder, run <kbd>bunx codex login</kbd>. Then
          ask again.
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

function NextQuestion({
  question,
  tickers,
  threadId,
}: {
  readonly question: string;
  readonly tickers: ReadonlyArray<string>;
  readonly threadId: string | null;
}) {
  const named = useQuery(namedCompanyQuery(question));
  const about = named.data?.state === "ready" ? [named.data.ticker] : tickers;
  return (
    <Link
      to="/ask"
      search={{
        q: question,
        ...(threadId === null ? {} : { t: threadId }),
        ...(about.length === 0 ? {} : { c: about.join(",") }),
      }}
      state={{ asked: true }}
    >
      <span>{question}</span>
      <Arrow />
    </Link>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
