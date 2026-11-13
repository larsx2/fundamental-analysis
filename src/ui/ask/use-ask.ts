import { useCallback, useEffect, useRef, useState } from "react";
import type { Answer, AskEvent, LookupResult } from "../../shared/lookups";

export type LookupRead = {
  readonly id: string;
  readonly lookup: string;
  readonly input: unknown;
  readonly status: "reading" | "read" | "failed";
  readonly result: LookupResult | null;
  readonly error: string | null;
};

export type Step =
  | { readonly kind: "thinking"; readonly id: string; readonly text: string }
  | { readonly kind: "lookup"; readonly id: string };

export type AskState = {
  readonly lookups: ReadonlyArray<LookupRead>;
  readonly steps: ReadonlyArray<Step>;
  readonly answer: Answer | null;
  readonly failure: {
    readonly signedOut: boolean;
    readonly message: string;
  } | null;
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
  readonly stopped: boolean;
  readonly done: boolean;
};

export const empty: AskState = {
  lookups: [],
  steps: [],
  answer: null,
  failure: null,
  startedAt: null,
  finishedAt: null,
  stopped: false,
  done: false,
};

const withStep = (steps: ReadonlyArray<Step>, step: Step) =>
  steps.some((each) => each.id === step.id) ? steps : [...steps, step];

export const apply = (state: AskState, event: AskEvent): AskState => {
  switch (event.type) {
    case "reading":
      return {
        ...state,
        steps: withStep(state.steps, { kind: "lookup", id: event.id }),
        lookups: [
          ...state.lookups.filter((each) => each.id !== event.id),
          {
            id: event.id,
            lookup: event.lookup,
            input: event.input,
            status: "reading",
            result: null,
            error: null,
          },
        ],
      };
    case "read": {
      const before = state.lookups.find((each) => each.id === event.id);
      const read: LookupRead = {
        id: event.id,
        lookup: event.lookup,
        input: before?.input ?? null,
        status: event.result === null ? "failed" : "read",
        result: event.result,
        error: event.error,
      };
      return {
        ...state,
        steps: withStep(state.steps, { kind: "lookup", id: event.id }),
        lookups:
          before === undefined
            ? [...state.lookups, read]
            : state.lookups.map((each) => (each.id === event.id ? read : each)),
      };
    }
    case "thinking":
      return {
        ...state,
        steps: withStep(state.steps, { kind: "thinking", id: event.id, text: event.text }),
      };
    case "answer":
      return { ...state, answer: event.answer, finishedAt: Date.now() };
    case "failed":
      return {
        ...state,
        failure: { signedOut: event.signedOut, message: event.message },
        finishedAt: Date.now(),
      };
  }
};

export type Earlier = { readonly question: string; readonly answer: string };

export const useAsk = (
  tickers: ReadonlyArray<string>,
  question: string,
  year: number | null,
  earlier: ReadonlyArray<Earlier>,
) => {
  const [state, setState] = useState<AskState>(empty);
  const running = useRef<AbortController | null>(null);
  const context = useRef(earlier);
  context.current = earlier;
  const tickerList = tickers.join(",");

  const stop = useCallback(() => {
    if (running.current === null || running.current.signal.aborted) return;
    running.current.abort();
    setState((now) =>
      now.answer === null && now.failure === null
        ? { ...now, stopped: true, finishedAt: Date.now(), done: true }
        : now,
    );
  }, []);

  useEffect(() => {
    setState(empty);
    if (question === "") return;
    setState({ ...empty, startedAt: Date.now() });
    const controller = new AbortController();
    running.current = controller;
    const fail = (message: string) =>
      setState((now) => ({
        ...now,
        failure: { signedOut: false, message },
        done: true,
      }));
    void (async () => {
      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tickers: tickerList === "" ? [] : tickerList.split(","),
            question,
            year,
            earlier: context.current,
          }),
          signal: controller.signal,
        });
        if (!response.ok || response.body === null) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          fail(body?.error ?? "The question could not be asked.");
          return;
        }
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let end = buffer.indexOf("\n");
          while (end !== -1) {
            const line = buffer.slice(0, end).trim();
            buffer = buffer.slice(end + 1);
            if (line !== "") {
              const event = JSON.parse(line) as AskEvent;
              setState((now) => apply(now, event));
            }
            end = buffer.indexOf("\n");
          }
        }
        setState((now) => ({ ...now, done: true }));
      } catch {
        if (!controller.signal.aborted) fail("The tool stopped answering. Ask again.");
      }
    })();
    return () => controller.abort();
  }, [tickerList, question, year]);

  return { state, stop };
};
