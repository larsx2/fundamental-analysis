import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { companiesQuery } from "../../functions/companies";
import { questions, topics } from "../../shared/questions";
import { useAskToCollect } from "../collect-dialog";
import { plainName, shortName } from "../logo-tile";
import { type Mention, MentionInput } from "../mention-input";
import { inWords } from "../../shared/format";
import { Clears, usePrefill } from "../prefill";
import { namedCompanyQuery } from "./named-company";

export function AskComposer({
  context,
  working,
  onStop,
  threadId,
  centred,
  offered,
}: {
  readonly context: ReadonlyArray<Mention>;
  readonly working: boolean;
  readonly onStop: () => void;
  readonly threadId: string | null;
  readonly centred: boolean;
  readonly offered: boolean;
}) {
  const navigate = useNavigate();
  const askToCollect = useAskToCollect();
  const { data } = useQuery(companiesQuery);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<ReadonlyArray<Mention>>([]);
  const form = useRef<HTMLFormElement>(null);
  const leftFrom = useRef<DOMRect | null>(null);

  useLayoutEffect(() => {
    const from = leftFrom.current;
    const box = form.current;
    if (centred || from === null || box === null) return;
    leftFrom.current = null;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = box.getBoundingClientRect();
    const dy = from.top - to.top;
    if (Math.abs(dy) < 2) return;
    box.animate(
      [{ transform: `translateY(${dy}px) scale(${from.width / to.width})` }, { transform: "none" }],
      { duration: 560, easing: "cubic-bezier(0.2, 0, 0, 1)" },
    );
  }, [centred]);

  const ready = (data?.companies ?? [])
    .filter((company) => company.state === "ready")
    .map((company) => ({
      cik: company.cik,
      ticker: company.ticker,
      name: company.name,
    }));
  const isReady = (cik: number) => ready.some((company) => company.cik === cik);
  const trimmed = text.trim();
  const { data: named } = useQuery({
    ...namedCompanyQuery(trimmed),
    enabled: trimmed.length >= 2 && mentions.length === 0,
    placeholderData: keepPreviousData,
  });
  const detected = trimmed.length >= 2 && mentions.length === 0 ? (named ?? null) : null;
  const targets: ReadonlyArray<Mention & { readonly ready: boolean }> =
    mentions.length > 0
      ? [...new Map(mentions.map((each) => [each.cik, each])).values()].map((each) => ({
          ...each,
          ready: isReady(each.cik),
        }))
      : detected !== null
        ? [{ ...detected, ready: detected.state === "ready" }]
        : context.map((each) => ({ ...each, ready: true }));
  const missing = targets.find((each) => !each.ready) ?? null;

  const prefill = usePrefill({ text, mentions }, (next, nextMentions) => {
    setText(next);
    setMentions(nextMentions);
  });

  const ask = () => {
    if (trimmed === "") return;
    if (missing !== null) {
      askToCollect({ cik: missing.cik, name: missing.name });
      return;
    }
    if (centred) leftFrom.current = form.current?.getBoundingClientRect() ?? null;
    setText("");
    setMentions([]);
    void navigate({
      to: "/ask",
      search: {
        q: trimmed,
        ...(threadId === null ? {} : { t: threadId }),
        ...(targets.length === 0 ? {} : { c: targets.map((each) => each.ticker).join(",") }),
      },
      state: { asked: true },
    });
  };

  const say: ReactNode =
    trimmed === "" ? null : missing !== null ? (
      <span>
        <strong>{plainName(missing.name)}</strong> is not collected yet.{" "}
        <button
          type="button"
          className="link-button"
          onClick={() => askToCollect({ cik: missing.cik, name: missing.name })}
        >
          Collect it
        </button>
      </span>
    ) : (
      <>
        <kbd>{"↵"}</kbd>
        <span>
          {targets.length === 0 ? (
            "Asks a general question"
          ) : (
            <>
              Asks about <strong>{inWords(targets.map((each) => shortName(each.name)))}</strong>
            </>
          )}
        </span>
      </>
    );

  const about = targets.length === 1 && missing === null ? targets[0]! : null;
  const preferred = [...ready].sort(
    (a, b) =>
      Number(b.ticker === "COST") - Number(a.ticker === "COST") ||
      Number(b.ticker === "AAPL") - Number(a.ticker === "AAPL"),
  );
  const starters = [
    { company: preferred[0], text: (name: string) => `Where does ${name}'s money go?` },
    { company: preferred[1], text: (name: string) => `Is ${name} growing?` },
  ].flatMap(({ company, text: question }) =>
    company === undefined ? [] : [{ company, question: question(shortName(company.name)) }],
  );

  return (
    <div className="ask-dock">
      <form
        ref={form}
        className={`composer ask-composer ${working ? "working" : ""}`}
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          ask();
        }}
        onKeyDown={prefill.onKeyDown}
      >
        <MentionInput
          id="ask-next"
          label="Ask a question"
          placeholder={
            working
              ? "Working on the answer. Type your next question, or stop it."
              : context.length === 0
                ? "Ask about any company"
                : `Ask about ${inWords(context.map((each) => shortName(each.name)))}, or name another company`
          }
          value={text}
          mentions={mentions}
          companies={ready}
          onChange={(next, nextMentions) => {
            setText(next);
            setMentions(nextMentions);
          }}
          onSubmit={ask}
        />
        <div className="tools ask-tools">
          {trimmed !== "" ? (
            <p className="intent ask-intent" role="status" aria-live="polite">
              {say}
              {prefill.pending && <Clears />}
            </p>
          ) : about !== null && !offered ? (
            <div className="ask-topics" role="group" aria-label="Topics">
              {topics.map((topic) => {
                const question = questions.find((each) => each.key === topic.key)!;
                return (
                  <button
                    key={topic.key}
                    type="button"
                    onClick={() => {
                      prefill.fill(question.text(shortName(about.name)), [
                        { cik: about.cik, ticker: about.ticker, name: about.name },
                      ]);
                      document.getElementById("ask-next")?.focus();
                    }}
                  >
                    {topic.name}
                  </button>
                );
              })}
            </div>
          ) : centred && starters.length > 0 && context.length === 0 ? (
            <div className="ask-topics" role="group" aria-label="Examples">
              {starters.map(({ company, question }) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => {
                    prefill.fill(question, [company]);
                    document.getElementById("ask-next")?.focus();
                  }}
                >
                  {question}
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}
          {working && trimmed === "" ? (
            <button
              type="button"
              className="send stop"
              aria-label="Stop the answer"
              onClick={onStop}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <rect x="4" y="4" width="8" height="8" rx="1.5" />
              </svg>
            </button>
          ) : (
            <button type="submit" className="send" aria-label="Ask" disabled={trimmed === ""}>
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 2.2 13.4 7.6l-1.2 1.2L8.9 5.5V14H7.1V5.5L3.8 8.8 2.6 7.6Z" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
