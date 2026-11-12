import { useEffect, useState } from "react";
import type { Answer, AskEvent, LookupResult } from "../../shared/lookups";

export type LookupRead = {
  readonly id: string;
  readonly lookup: string;
  readonly status: "reading" | "read" | "failed";
  readonly result: LookupResult | null;
  readonly error: string | null;
};

export type AskState = {
  readonly lookups: ReadonlyArray<LookupRead>;
  readonly answer: Answer | null;
  readonly failure: {
    readonly signedOut: boolean;
    readonly message: string;
  } | null;
  readonly done: boolean;
};

const empty: AskState = {
  lookups: [],
  answer: null,
  failure: null,
  done: false,
};

const apply = (state: AskState, event: AskEvent): AskState => {
  switch (event.type) {
    case "reading":
      return {
        ...state,
        lookups: [
          ...state.lookups.filter((each) => each.id !== event.id),
          {
            id: event.id,
            lookup: event.lookup,
            status: "reading",
            result: null,
            error: null,
          },
        ],
      };
    case "read": {
      const read: LookupRead = {
        id: event.id,
        lookup: event.lookup,
        status: event.result === null ? "failed" : "read",
        result: event.result,
        error: event.error,
      };
      const known = state.lookups.some((each) => each.id === event.id);
      return {
        ...state,
        lookups: known
          ? state.lookups.map((each) => (each.id === event.id ? read : each))
          : [...state.lookups, read],
      };
    }
    case "answer":
      return { ...state, answer: event.answer };
    case "failed":
      return {
        ...state,
        failure: { signedOut: event.signedOut, message: event.message },
      };
  }
};

export const useAsk = (ticker: string, question: string) => {
  const [state, setState] = useState<AskState>(empty);

  useEffect(() => {
    setState(empty);
    if (question === "") return;
    const controller = new AbortController();
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
          body: JSON.stringify({ ticker, question }),
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
  }, [ticker, question]);

  return state;
};
