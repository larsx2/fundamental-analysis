import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { splitFigures } from "../../shared/answer-figures";
import type { Answer, AskEvent, LookupResult } from "../../shared/lookups";
import { appServer, flagsFor, type Notification } from "./codex-app-server";
import type { LookupReply } from "./look-up";
import { catalog } from "./lookups";

const bridge = resolve("src/server/agent/bridge.ts");

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

export type Prefetched = {
  readonly id: string;
  readonly ticker: string;
  readonly lookup: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly result: LookupResult;
};

export const upFront = (ticker: string, fiscalYear: number | null) => {
  const year = fiscalYear === null ? {} : { fiscalYear };
  return [
    { lookup: "dollar", input: { ticker, ...year } },
    { lookup: "balance", input: { ticker, ...year } },
    { lookup: "cash", input: { ticker } },
    { lookup: "uses_of_cash", input: { ticker } },
    {
      lookup: "trend",
      input: { ticker, terms: ["Revenue", "Net income", "Free cash flow"] },
    },
    { lookup: "returns", input: { ticker } },
    { lookup: "context", input: { ticker } },
    { lookup: "marks", input: { ticker, ...year } },
    { lookup: "company", input: { ticker } },
  ];
};

type Schema = {
  readonly type?: string;
  readonly items?: { readonly enum?: ReadonlyArray<string> };
};

const argument = (name: string, schema: Schema, required: ReadonlyArray<string>) => {
  const type =
    schema.type === "array"
      ? `(${schema.items?.enum?.map((each) => JSON.stringify(each)).join(" | ") ?? "string"})[]`
      : schema.type === "integer"
        ? "number"
        : (schema.type ?? "string");
  return `${name}${required.includes(name) ? "" : "?"}: ${type}`;
};

const signature = (lookup: (typeof catalog)[number]) => {
  const { properties, required } = lookup.inputSchema as {
    readonly properties: Readonly<Record<string, Schema>>;
    readonly required: ReadonlyArray<string>;
  };
  const args = Object.entries(properties)
    .map(([name, schema]) => argument(name, schema, required))
    .join(", ");
  return `- tools.mcp__lookups__${lookup.name}({ ${args} }): ${lookup.description}`;
};

const callingLookups = (names: ReadonlyArray<string>) =>
  `Inside the exec tool the lookups are already loaded as written below, so never list or search ALL_TOOLS, and call every lookup you need in one exec call.
${catalog
  .filter((lookup) => names.includes(lookup.name))
  .map(signature)
  .join("\n")}`;

const alreadyRead = (already: ReadonlyArray<Prefetched>) =>
  already.length === 0
    ? ""
    : `Already read
These lookups were read before the question was asked. Answer from them when they hold what you need, without calling any lookup.
${already
  .map((read) =>
    JSON.stringify({
      ticker: read.ticker,
      lookup: read.lookup,
      input: read.input,
      figures: read.result.figures,
      notes: read.result.notes,
    }),
  )
  .join("\n")}

`;

const general = (
  question: string,
  earlier: ReadonlyArray<{
    readonly question: string;
    readonly answer: string;
  }>,
) =>
  `You answer one general question about company finances for someone new to finance. You work inside a learning tool that explains how US public companies' annual reports (10-K) work, and holds a glossary of their terms.

Use only the tools of the "lookups" server. Do not run commands, read files or search the web. Call the glossary lookup for the words the question is about, each at most once, and answer from what it says. If the question is about one company's figures but names no company, say so in the lead and ask the reader to name the company. Never answer from memory, give no advice on buying or selling, and make no forecasts.

${callingLookups(["glossary"])}

Answer
Reply with JSON that matches the schema:
- lead: one short sentence that answers the question.
- sentences: one to three short sentences that explain it, in the glossary's words.
- drawing: "".
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
  earlier: ReadonlyArray<{
    readonly question: string;
    readonly answer: string;
  }> = [],
  already: ReadonlyArray<Prefetched> = [],
): string => {
  if (companies.length === 0) return general(question, earlier);
  const named = companies.map((company) => `${company.name} (ticker ${company.ticker})`);
  const about =
    named.length === 1 ? named[0]! : `${named.slice(0, -1).join(", ")} and ${named.at(-1)}`;
  const several = companies.length > 1;
  return `You answer one question about ${about}, ${several ? "US public companies" : "a US public company"}, for someone new to finance. You work inside a learning tool that holds ${several ? "each company's" : "the company's"} figures from its annual reports (10-K).${several ? " Read the same lookups for each company, passing its ticker, so the answer compares like with like." : ""}

Use only the tools of the "lookups" server. Do not run commands, read files or search the web. Call as few lookups as the answer needs, each at most once. Call the glossary lookup only when the question asks what a word means: the screen already explains every term.

Lookups
${callingLookups(catalog.map((lookup) => lookup.name))}

${alreadyRead(already)}Figures
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

export const usedBy = (
  answer: Answer,
  already: ReadonlyArray<Prefetched>,
  live: ReadonlyArray<LookupResult> = [],
) => {
  const known = [
    ...already.flatMap((read) =>
      Object.values(read.result.figures).map((text) => ({ text, source: read.id })),
    ),
    ...live.flatMap((result) =>
      Object.values(result.figures).map((text) => ({ text, source: "live" })),
    ),
  ];
  const sources = new Set(
    [answer.lead, ...answer.sentences].flatMap((text) =>
      splitFigures(text, known).flatMap((piece) => (piece.kind === "figure" ? [piece.source] : [])),
    ),
  );
  const used = already.filter((read) => sources.has(read.id));
  const drawn = already.find((read) => read.lookup === answer.drawing);
  const shown = [...used.map((read) => read.lookup), ...live.map((result) => result.lookup)];
  return drawn === undefined || shown.includes(drawn.lookup) ? used : [...used, drawn];
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

const signedOutWords = /\b(log ?in|sign(ed)? ?in|unauthori[sz]ed|401)\b|not authenticated/i;

const failed = (cause: unknown): AskEvent => {
  const message = cause instanceof Error ? cause.message : String(cause);
  return { type: "failed", signedOut: signedOutWords.test(message), message };
};

const strayed: AskEvent = {
  type: "failed",
  signedOut: false,
  message: "Codex tried to use something other than the tool's lookups, so the answer was stopped.",
};

const readerServers = (readerConfig: string | null | Error): ReadonlyArray<string> | null => {
  if (readerConfig === null) return [];
  if (readerConfig instanceof Error) return null;
  try {
    const servers = (Bun.TOML.parse(readerConfig) as { mcp_servers?: unknown }).mcp_servers;
    if (servers === undefined) return [];
    return typeof servers === "object" && servers !== null && !Array.isArray(servers)
      ? Object.keys(servers)
      : null;
  } catch {
    return null;
  }
};

const switchable = /^[A-Za-z0-9_-]+$/;

export const settingsFor = (lookupsUrl: string, readerConfig: string | null | Error) => {
  const names = readerServers(readerConfig);
  if (names === null) {
    return {
      refused:
        "Your Codex settings could not be read, so the tool cannot make sure Codex uses only its lookups. Check ~/.codex/config.toml.",
    };
  }
  const unswitchable = names.find((name) => !switchable.test(name));
  if (unswitchable !== undefined) {
    return {
      refused: `Your Codex settings name a server, "${unswitchable}", that the tool cannot switch off, so it cannot make sure Codex uses only its lookups. Rename it in ~/.codex/config.toml.`,
    };
  }
  return {
    settings: {
      model_reasoning_summary: "concise",
      web_search: "disabled",
      thread_unload_delay_secs: 86400,
      include_permissions_instructions: false,
      include_environment_context: false,
      include_collaboration_mode_instructions: false,
      skills: { include_instructions: false },
      features: {
        shell_tool: false,
        view_image: false,
        plugins: false,
        apps: false,
        hooks: false,
        tool_suggest: false,
        sleep_tool: false,
      },
      mcp_servers: {
        ...Object.fromEntries(names.map((name) => [name, { enabled: false }])),
        lookups: {
          command: process.execPath,
          args: [bridge],
          env: { LOOKUPS_URL: lookupsUrl },
          default_tools_approval_mode: "approve",
        },
      },
    },
  };
};

export const readReaderConfig = (
  home = process.env.CODEX_HOME ?? join(homedir(), ".codex"),
): string | null | Error => {
  try {
    return readFileSync(join(home, "config.toml"), "utf8");
  } catch (cause) {
    return (cause as NodeJS.ErrnoException).code === "ENOENT" ? null : (cause as Error);
  }
};

type Item = Readonly<Record<string, unknown>> & {
  readonly type: string;
  readonly id: string;
};

const quiet = new Set(["userMessage", "agentMessage", "reasoning", "plan", "contextCompaction"]);

const sentences = (lines: ReadonlyArray<string>) =>
  lines
    .flatMap((each) => each.split("\n"))
    .map((line) => line.replaceAll("**", "").trim())
    .filter((line) => line !== "")
    .reduce(
      (joined, line) =>
        joined === "" ? line : `${joined}${/[.:?!]$/.test(joined) ? "" : "."} ${line}`,
      "",
    );

const lookupRead = (item: Item): AskEvent => {
  const result = item.result as
    | {
        readonly structuredContent?: unknown;
        readonly content?: ReadonlyArray<unknown>;
      }
    | null
    | undefined;
  const structured = result?.structuredContent;
  const text = result?.content?.find(
    (block): block is { type: "text"; text: string } =>
      typeof block === "object" && block !== null && "text" in block,
  );
  const error = (item.error as { readonly message?: string } | null | undefined)?.message;
  return {
    type: "read",
    id: item.id,
    lookup: String(item.tool),
    result: isLookupResult(structured) ? structured : null,
    error: isLookupResult(structured)
      ? null
      : (error ?? text?.text ?? "The lookup gave nothing back."),
  };
};

export const toEvent = (notification: Notification): AskEvent | null => {
  const { method, params } = notification;
  if (method === "error") {
    if (params.willRetry === true) return null;
    return failed((params.error as { readonly message?: string } | undefined)?.message ?? method);
  }
  if (method !== "item/started" && method !== "item/completed") return null;
  const item = params.item as Item;
  const lookup = item.type === "mcpToolCall" && item.server === "lookups";
  if (!lookup && !quiet.has(item.type)) return strayed;
  if (lookup) {
    return method === "item/started"
      ? {
          type: "reading",
          id: item.id,
          lookup: String(item.tool),
          input: item.arguments ?? null,
        }
      : lookupRead(item);
  }
  if (method !== "item/completed") return null;
  if (item.type === "agentMessage") {
    const text = typeof item.text === "string" ? item.text : "";
    const answer = readAnswer(text);
    return answer === null
      ? { type: "thinking", id: item.id, text: text.trim() }
      : { type: "answer", answer };
  }
  if (item.type === "reasoning") {
    const text = sentences((item.summary as ReadonlyArray<string> | undefined) ?? []);
    return text === "" ? null : { type: "thinking", id: item.id, text };
  }
  return null;
};

export const readUpFront = async (
  companies: ReadonlyArray<{ readonly ticker: string }>,
  fiscalYear: number | null,
  read: (name: string, input: unknown) => Promise<LookupReply>,
): Promise<ReadonlyArray<Prefetched>> => {
  const wanted = companies.flatMap((company) =>
    upFront(company.ticker, fiscalYear).map((each) => ({
      ...each,
      ticker: company.ticker,
    })),
  );
  const replies = await Promise.all(
    wanted.map((each) => read(each.lookup, each.input).catch(() => null)),
  );
  return wanted.flatMap((each, index) => {
    const reply = replies[index];
    return reply != null && "result" in reply
      ? [{ id: `${each.ticker}-${each.lookup}`, ...each, result: reply.result }]
      : [];
  });
};

export const warm = (lookupsUrl: string) => {
  const configured = settingsFor(lookupsUrl, readReaderConfig());
  if ("settings" in configured) appServer(flagsFor(configured.settings)).warm();
};

export async function* ask(input: {
  readonly question: string;
  readonly companies: ReadonlyArray<{
    readonly name: string;
    readonly ticker: string;
  }>;
  readonly fiscalYear: number | null;
  readonly earlier: ReadonlyArray<{
    readonly question: string;
    readonly answer: string;
  }>;
  readonly lookupsUrl: string;
  readonly read: (name: string, input: unknown) => Promise<LookupReply>;
  readonly signal: AbortSignal;
}): AsyncGenerator<AskEvent> {
  const configured = settingsFor(input.lookupsUrl, readReaderConfig());
  if ("refused" in configured) {
    yield { type: "failed", signedOut: false, message: configured.refused };
    return;
  }
  const server = appServer(flagsFor(configured.settings));
  const [thread, already] = await Promise.all([
    server.thread().catch((cause: unknown) => cause as Error),
    readUpFront(input.companies, input.fiscalYear, input.read),
  ]);
  if (thread instanceof Error) {
    yield failed(thread);
    return;
  }
  if (input.signal.aborted) return;
  const queue: Array<Notification> = [];
  let wake: (() => void) | null = null;
  const stopListening = server.listen(thread, (notification) => {
    queue.push(notification);
    wake?.();
  });
  let turn: string | null = null;
  const interrupt = () => {
    if (turn !== null) void server.request("turn/interrupt", { threadId: thread, turnId: turn });
    wake?.();
  };
  input.signal.addEventListener("abort", interrupt, { once: true });
  try {
    const started = (await server.request("turn/start", {
      threadId: thread,
      input: [
        {
          type: "text",
          text: promptFor(
            input.question,
            input.companies,
            input.fiscalYear,
            input.earlier,
            already,
          ),
          text_elements: [],
        },
      ],
      outputSchema: answerSchema,
      effort: "medium",
    })) as { turn: { id: string } };
    turn = started.turn.id;
    if (input.signal.aborted) interrupt();
    let answered = false;
    const live: Array<LookupResult> = [];
    while (!input.signal.aborted) {
      const notification = queue.shift();
      if (notification === undefined) {
        await new Promise<void>((settle) => {
          wake = settle;
        });
        wake = null;
        continue;
      }
      if (notification.method === "turn/completed") {
        const error = (
          notification.params.turn as { readonly error?: { readonly message?: string } | null }
        ).error;
        if (error?.message !== undefined) {
          yield failed(error.message);
          answered = true;
        }
        break;
      }
      const next = toEvent(notification);
      if (next === null) continue;
      if (next === strayed) {
        yield next;
        interrupt();
        return;
      }
      if (next.type === "read" && next.result !== null) live.push(next.result);
      if (next.type === "answer") {
        for (const read of usedBy(next.answer, already, live)) {
          yield {
            type: "reading",
            id: read.id,
            lookup: read.lookup,
            input: read.input,
          };
          yield {
            type: "read",
            id: read.id,
            lookup: read.lookup,
            result: read.result,
            error: null,
          };
        }
      }
      if (next.type === "answer" || next.type === "failed") answered = true;
      yield next;
      if (answered) break;
    }
    if (!answered && !input.signal.aborted) {
      yield failed("The answer came back in a shape the tool cannot read.");
    }
  } catch (cause) {
    if (!input.signal.aborted) yield failed(cause);
  } finally {
    input.signal.removeEventListener("abort", interrupt);
    stopListening();
    void server.request("thread/unsubscribe", { threadId: thread }).catch(() => undefined);
  }
}
