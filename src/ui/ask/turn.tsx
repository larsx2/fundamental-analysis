import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { KnownFigure } from "../../shared/answer-figures";
import type { CompanyScreen } from "../palette";
import { AnswerText, termsToLink, uncheckedIn } from "./answer-text";
import type { Company } from "./conversations";
import { DrawingPanel } from "./drawing";
import { namedCompanyQuery } from "./named-company";
import type { AskState } from "./use-ask";

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

const drawnIn = (state: AskState) => {
  const answer = state.answer;
  return answer === null || answer.drawing === null
    ? undefined
    : state.lookups.findLast(
        (read) => read.lookup === answer.drawing && read.result?.drawing != null,
      );
};

export const drawingTitle = (state: AskState | undefined) =>
  state === undefined ? null : (drawnIn(state)?.result?.drawing?.title ?? null);

export function TurnView({
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
      : Object.values(read.result.figures).map((text) => ({
          text,
          source: `${id}:${read.id}`,
        })),
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
