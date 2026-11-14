import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { companiesQuery } from "../../functions/companies";
import { plainName, shortName } from "../logo-tile";
import { Screen } from "../screen";
import { Activity } from "./activity";
import { AskComposer } from "./composer";
import {
  addTurn,
  type Company,
  companiesOfTurn,
  startThread,
  useThreads,
  useThreadsKnown,
} from "./conversations";
import { useFollowBottom } from "./follow";
import { History } from "./history";
import { namedCompanyQuery } from "./named-company";
import { Sources } from "./sources";
import { drawingTitle, TurnView } from "./turn";
import { type AskState, useAsk, warmAsk } from "./use-ask";

declare module "@tanstack/history" {
  interface HistoryState {
    asked?: boolean;
  }
}

const answerText = (state: AskState) =>
  state.answer === null ? "" : [state.answer.lead, ...state.answer.sentences].join(" ");

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
  const turns = useMemo(() => thread?.turns ?? [], [thread]);
  const pending = q ?? "";
  const asked = useLocation({ select: (location) => location.state.asked === true });
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const { data: listed } = useQuery(companiesQuery);
  const named = useQuery({
    ...namedCompanyQuery(pending),
    enabled: pending !== "" && c.length === 0,
  });
  const namedCompany = named.data;
  const pendingCompanies = useMemo(
    (): ReadonlyArray<Company> =>
      c.length > 0
        ? c.map((ticker) => {
            const found = listed?.companies.find(
              (each) => each.ticker.toUpperCase() === ticker.toUpperCase(),
            );
            return found === undefined
              ? { ticker, cik: 0, name: ticker }
              : { ticker: found.ticker, cik: found.cik, name: found.name };
          })
        : namedCompany?.state === "ready"
          ? [{ ticker: namedCompany.ticker, cik: namedCompany.cik, name: namedCompany.name }]
          : start === null
            ? []
            : [start],
    [c, listed, namedCompany, start],
  );
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

  useEffect(warmAsk, []);

  useEffect(() => {
    document.title = pending !== "" ? pending : (turns[0]?.question ?? "Ask");
  }, [pending, turns]);

  useEffect(() => {
    if (pending === "" && t !== undefined && start !== null) {
      void navigate({ to: "/ask", search: { t }, replace: true });
    }
  }, [pending, t, start, navigate]);

  useFollowBottom(article, `${pending}|${t}`);

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
  const lastTurn = turns.at(-1);
  const context =
    lastTurn !== undefined ? companiesOfTurn(lastTurn) : start === null ? [] : [start];
  const name = start === null ? null : shortName(start.name);
  const known = useThreadsKnown();
  const waiting = !known && t !== undefined;
  const blank = turns.length === 0 && pending === "" && !waiting;

  return (
    <Screen active="ask" className="ask-page" settle={false}>
      <h1 className="visually-hidden">
        {start === null ? "Ask" : `Ask about ${plainName(start.name)}`}
      </h1>
      <div className="ask-backdrop" data-blank={blank} aria-hidden="true">
        <div className="ask-glow" />
        <div className="ask-dots" />
      </div>
      <div className="ask-layout">
        <History threads={threads} current={thread?.id ?? null} />
        <article
          ref={article}
          className={blank ? "ask-answer blank" : "ask-answer"}
          aria-live="polite"
          aria-busy={working}
        >
          <div key={thread?.id ?? "new"} className="ask-thread">
            {blank && (
              <header className="ask-empty">
                <h2>{name === null ? "What do you want to understand?" : `Ask about ${name}`}</h2>
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
            centred={blank}
          />
          {blank && (
            <p className="ask-foot ask-empty-note">
              Uses your ChatGPT subscription. Your database stays on this computer.
            </p>
          )}
        </article>
        {latest.state.lookups.length > 0 && (
          <Sources turnId={latest.id} state={latest.state} lit={lit} onLight={setLit} />
        )}
      </div>
    </Screen>
  );
}
