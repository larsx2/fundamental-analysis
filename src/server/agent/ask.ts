import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Codex, type ThreadEvent } from "@openai/codex-sdk";
import type { Answer, AskEvent, LookupResult } from "../../shared/lookups";

const bridge = resolve("src/server/agent/bridge.ts");

let workplace: string | null = null;
const emptyFolder = () =>
  (workplace ??= mkdtempSync(join(tmpdir(), "fundamental-analysis-agent-")));

const answerSchema = {
  type: "object",
  properties: {
    lead: { type: "string" },
    sentences: { type: "array", items: { type: "string" } },
    drawing: { type: "string" },
    next: { type: "array", items: { type: "string" } },
  },
  required: ["lead", "sentences", "drawing", "next"],
  additionalProperties: false,
} as const;

const general = (
  question: string,
  earlier: ReadonlyArray<{ readonly question: string; readonly answer: string }>,
) =>
  `You answer one general question about company finances for someone new to finance. You work inside a learning tool that explains how US public companies' annual reports (10-K) work, and holds a glossary of their terms.

Use only the tools of the "lookups" server. Do not run commands, read files or search the web. Call the glossary lookup for the words the question is about, each at most once, and answer from what it says. If the question is about one company's figures but names no company, say so in the lead and ask the reader to name the company. Never answer from memory, give no advice on buying or selling, and make no forecasts.

Answer
Reply with JSON that matches the schema:
- lead: one short sentence that answers the question.
- sentences: one to three short sentences that explain it, in the glossary's words.
- drawing: "" .
- next: three short questions a beginner might ask next, about words or ideas, or about a company such as "Is Apple growing?".

${
  earlier.length === 0
    ? ""
    : `Earlier in this conversation:\n${earlier
        .map((turn) => `Question: ${turn.question}\nAnswer: ${turn.answer}`)
        .join("\n\n")}\n\nAnswer the new question in that context.\n\n`
}The question: ${question}`;

export const promptFor = (
  question: string,
  companies: ReadonlyArray<{ readonly name: string; readonly ticker: string }>,
  fiscalYear: number | null = null,
  earlier: ReadonlyArray<{ readonly question: string; readonly answer: string }> = [],
): string => {
  if (companies.length === 0) return general(question, earlier);
  const named = companies.map((company) => `${company.name} (ticker ${company.ticker})`);
  const about =
    named.length === 1 ? named[0]! : `${named.slice(0, -1).join(", ")} and ${named.at(-1)}`;
  const several = companies.length > 1;
  return `You answer one question about ${about}, ${several ? "US public companies" : "a US public company"}, for someone new to finance. You work inside a learning tool that holds ${several ? "each company's" : "the company's"} figures from its annual reports (10-K).${several ? " Read the same lookups for each company, passing its ticker, so the answer compares like with like." : ""}

Use only the tools of the "lookups" server. Do not run commands, read files or search the web. Call as few lookups as the answer needs, each at most once. Call the glossary lookup only when the question asks what a word means: the screen already explains every term.

Figures
- Copy every number in your answer character for character from the "figures" of a lookup result, with its dollar sign, unit, sign and rounding. Never calculate, round, convert, subtract or write a number that is not there. If you need a figure that is not there, call the lookup that gives it, or say the tool does not hold it.
- A change carries its own sign, such as +10.1%. Write it after words like "a change of" or "a year-over-year change of", never after "up", "down", "grew" or "fell".

Words
- Use the glossary's words: revenue, not sales; net income, not profit or earnings; fiscal 2026, not FY26. Net income is what is left of each dollar, never what the company keeps.
- Say what happened. No judgement of the company, no forecast and no advice on buying or selling. If asked whether to buy, or whether the shares are cheap, say the tool cannot tell, because it has no share prices and makes no forecasts, then say what the figures show about the business.
- If the lookups cannot answer, say so in the lead and name what the tool does not collect, from the notes of the company lookup. Never answer from memory.

Answer
Reply with JSON that matches the schema:
- lead: one short sentence that answers the question.
- sentences: one to three short sentences with the figures behind it.
- drawing: the name of the one lookup whose drawing shows the answer best (trend, dollar, cash, balance, uses_of_cash, returns, context, marks or company), or "" for none.
- next: three short questions about ${several ? "these companies" : companies[0]!.name} that these lookups can answer.

${fiscalYear === null ? "When the question names no year, answer for the latest fiscal year, unless the conversation so far is about another year.\n\n" : `The reader has fiscal ${fiscalYear} chosen. When the question names no fiscal year, answer for fiscal ${fiscalYear}, and pass fiscalYear ${fiscalYear} to every lookup that takes one.\n\n`}${
    earlier.length === 0
      ? ""
      : `Earlier in this conversation (it may have been about other companies; this question is about ${about}):\n${earlier
          .map((turn) => `Question: ${turn.question}\nAnswer: ${turn.answer}`)
          .join(
            "\n\n",
          )}\n\nAnswer the new question in that context: words like "it", "that" or "the year before" refer to what was discussed. Still take every figure from a lookup, even one given earlier.\n\n`
  }The question: ${question}`;
};

const isLookupResult = (value: unknown): value is LookupResult =>
  typeof value === "object" &&
  value !== null &&
  "lookup" in value &&
  "figures" in value &&
  "filings" in value;

const readAnswer = (text: string): Answer | null => {
  try {
    const parsed = JSON.parse(text) as Partial<Record<keyof Answer, unknown>>;
    if (typeof parsed.lead !== "string" || !Array.isArray(parsed.sentences)) return null;
    return {
      lead: parsed.lead,
      sentences: parsed.sentences.map(String),
      drawing: typeof parsed.drawing === "string" && parsed.drawing !== "" ? parsed.drawing : null,
      next: Array.isArray(parsed.next) ? parsed.next.map(String).slice(0, 3) : [],
    };
  } catch {
    return null;
  }
};

const signedOutWords = /log ?in|sign(ed)? ?in|unauthori[sz]ed|401|auth/i;

const failed = (cause: unknown): AskEvent => {
  const message = cause instanceof Error ? cause.message : String(cause);
  return { type: "failed", signedOut: signedOutWords.test(message), message };
};

const toEvent = (event: ThreadEvent): AskEvent | null => {
  if (event.type === "turn.failed") return failed(event.error.message);
  if (event.type === "error") return failed(event.message);
  if (event.type !== "item.started" && event.type !== "item.completed") return null;
  const item = event.item;
  if (item.type === "mcp_tool_call") {
    if (event.type === "item.started") {
      return { type: "reading", id: item.id, lookup: item.tool, input: item.arguments ?? null };
    }
    const structured = item.result?.structured_content;
    const text = item.result?.content.find((block) => block.type === "text");
    return {
      type: "read",
      id: item.id,
      lookup: item.tool,
      result: isLookupResult(structured) ? structured : null,
      error: isLookupResult(structured)
        ? null
        : (item.error?.message ??
          (text !== undefined && "text" in text ? text.text : "The lookup gave nothing back.")),
    };
  }
  if (event.type !== "item.completed") return null;
  if (item.type === "agent_message") {
    const answer = readAnswer(item.text);
    return answer === null
      ? { type: "thinking", id: item.id, text: item.text.trim() }
      : { type: "answer", answer };
  }
  if (item.type === "reasoning") {
    const text = item.text
      .split("\n")
      .map((line) => line.replaceAll("**", "").trim())
      .filter((line) => line !== "")
      .join(". ");
    return text === "" ? null : { type: "thinking", id: item.id, text };
  }
  return null;
};

export async function* ask(input: {
  readonly question: string;
  readonly companies: ReadonlyArray<{ readonly name: string; readonly ticker: string }>;
  readonly fiscalYear: number | null;
  readonly earlier: ReadonlyArray<{ readonly question: string; readonly answer: string }>;
  readonly lookupsUrl: string;
  readonly signal: AbortSignal;
}): AsyncGenerator<AskEvent> {
  await new Promise((settle) => setTimeout(settle, 250));
  if (input.signal.aborted) return;
  const codex = new Codex({
    config: {
      model_reasoning_summary: "concise",
      mcp_servers: {
        lookups: {
          command: process.execPath,
          args: [bridge],
          env: { LOOKUPS_URL: input.lookupsUrl },
          default_tools_approval_mode: "approve",
        },
      },
    },
  });
  const thread = codex.startThread({
    workingDirectory: emptyFolder(),
    skipGitRepoCheck: true,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    networkAccessEnabled: false,
    webSearchMode: "disabled",
    modelReasoningEffort: "medium",
  });
  // Stopping Codex before it has read the question breaks its input pipe, which ends the whole app.
  const stop = new AbortController();
  let started = false;
  const onAbort = () => {
    if (started) stop.abort();
  };
  input.signal.addEventListener("abort", onAbort, { once: true });
  try {
    const { events } = await thread.runStreamed(
      promptFor(input.question, input.companies, input.fiscalYear, input.earlier),
      {
        outputSchema: answerSchema,
        signal: stop.signal,
      },
    );
    let answered = false;
    for await (const event of events) {
      if (!started) {
        started = true;
        if (input.signal.aborted) stop.abort();
      }
      const next = toEvent(event);
      if (next === null) continue;
      if (next.type === "answer" || next.type === "failed") answered = true;
      yield next;
    }
    if (!answered && !input.signal.aborted) {
      yield failed("The answer came back in a shape the tool cannot read.");
    }
  } catch (cause) {
    if (!input.signal.aborted) yield failed(cause);
  } finally {
    input.signal.removeEventListener("abort", onAbort);
  }
}
