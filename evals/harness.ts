import { createHarness, type TranscriptEvent } from "vitest-evals";
import type { AskEvent } from "../src/shared/lookups";
import type { Case } from "./questions";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type Read = {
  lookup: string;
  input: Json;
  figures: Record<string, string> | null;
  error: string | null;
};

export type Answer = {
  lead: string;
  sentences: string[];
  quotes: { text: string; source: string; url: string }[];
  drawing: string | null;
  next: string[];
};

export type AskOutput = {
  answer: Answer | null;
  failure: string | null;
  reads: Read[];
  seconds: number;
  trips: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
};

const endpoint = process.env.ASK_URL ?? "http://127.0.0.1:4100/api/ask";

export const ask = async (input: Case, signal?: AbortSignal): Promise<AskOutput> => {
  const started = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tickers: input.tickers,
      question: input.question,
      earlier: input.earlier,
    }),
    signal,
  });
  if (!response.ok) {
    return {
      answer: null,
      failure: `The app answered ${response.status}: ${await response.text()}`,
      reads: [],
      seconds: 0,
      trips: null,
      inputTokens: null,
      cachedInputTokens: null,
    };
  }
  const events = (await response.text())
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as AskEvent);
  const inputs = new Map<string, Json>(
    events.flatMap((event) =>
      event.type === "reading" ? [[event.id, event.input as Json] as const] : [],
    ),
  );
  const answered = events.find((event) => event.type === "answer");
  const failed = events.find((event) => event.type === "failed");
  const usage = events.find((event) => event.type === "usage");
  return {
    answer:
      answered?.type === "answer"
        ? {
            lead: answered.answer.lead,
            sentences: [...answered.answer.sentences],
            quotes: (answered.answer.quotes ?? []).map((quote) => ({ ...quote })),
            drawing: answered.answer.drawing,
            next: [...answered.answer.next],
          }
        : null,
    failure: failed?.type === "failed" ? failed.message : null,
    reads: events.flatMap((event) =>
      event.type === "read"
        ? [
            {
              lookup: event.lookup,
              input: inputs.get(event.id) ?? null,
              figures: event.result === null ? null : { ...event.result.figures },
              error: event.error,
            },
          ]
        : [],
    ),
    seconds: Math.round((performance.now() - started) / 100) / 10,
    trips: usage?.type === "usage" ? usage.trips : null,
    inputTokens: usage?.type === "usage" ? usage.inputTokens : null,
    cachedInputTokens: usage?.type === "usage" ? usage.cachedInputTokens : null,
  };
};

export const answerText = (answer: Answer | null) =>
  answer === null ? "" : [answer.lead, ...answer.sentences].join(" ");

export const appHarness = createHarness<Case, AskOutput>({
  name: "fundamental-analysis-ask",
  run: async ({ input, signal }) => {
    const output = await ask(input, signal);
    const events: TranscriptEvent[] = [
      { type: "message", role: "user", content: input.question },
      ...output.reads.flatMap((read, index): TranscriptEvent[] => [
        {
          type: "tool_call",
          id: `read-${index}`,
          name: read.lookup,
          arguments: (typeof read.input === "object" &&
          read.input !== null &&
          !Array.isArray(read.input)
            ? read.input
            : {}) as Record<string, Json>,
        },
        {
          type: "tool_result",
          toolCallId: `read-${index}`,
          name: read.lookup,
          content: read.figures ?? { error: read.error },
        },
      ]),
      { type: "message", role: "assistant", content: output.failure ?? answerText(output.answer) },
    ];
    return {
      events,
      output,
      artifacts: { seconds: output.seconds },
      usage: {},
    };
  },
});
