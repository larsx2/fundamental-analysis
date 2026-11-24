import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { Data, Effect, Queue, Schema, Stream } from "effect";
import { figuresOf, isReportLookup, splitFigures } from "../../shared/answer-figures";
import type { Answer, AskEvent, LookupResult } from "../../shared/lookups";
import { Agent } from "./agent";
import { CodexUnexpected, type Connection, flagsFor, type Notification } from "./codex-app-server";
import type { LookupReply } from "./look-up";
import { catalog } from "./lookups";

const bridge = resolve("src/server/agent/bridge.ts");

const answerSchema = {
  type: "object",
  properties: {
    lead: { type: "string" },
    sentences: { type: "array", items: { type: "string" } },
    quotes: { type: "array", items: { type: "string" } },
    drawing: { type: "string" },
    next: { type: "array", items: { type: "string" } },
  },
  required: ["lead", "sentences", "quotes", "drawing", "next"],
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

type InputSchema = {
  readonly type?: string;
  readonly items?: { readonly enum?: ReadonlyArray<string> };
};

const argument = (name: string, schema: InputSchema, required: ReadonlyArray<string>) => {
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
    readonly properties: Readonly<Record<string, InputSchema>>;
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

const otherNames =
  "When the question uses a name the glossary says a term is also called, name it once to connect it to the glossary's term, then use only the term.";

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
- sentences: one to three short sentences that explain it, in the glossary's words. ${otherNames}
- quotes: none.
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

Use only the tools of the "lookups" server. Do not run commands, read files or search the web. Call as few lookups as the answer needs, each at most once, except searches of the annual report. Call the glossary lookup only when the question asks what a word means: the screen already explains every term.

Lookups
${callingLookups(catalog.map((lookup) => lookup.name))}

${alreadyRead(already)}Figures
- Copy every number in your answer character for character from the "figures" of a lookup result, with its dollar sign, unit, sign and rounding. Never calculate, round, convert, subtract or write a number that is not there. If you need a figure that is not there, call the lookup that gives it, or say the tool does not hold it.
- A change carries its own sign, such as +10.1%. Write it after words like "a change of" or "a year-over-year change of", never after "up", "down", "grew" or "fell".
- A figure below zero keeps its minus sign, such as net income of −$102 million. Never turn it into words such as "a loss of $102 million".

The annual report
- For what the company says in words, such as what it does, who it competes with, its risks, its suppliers and customers, or why its results changed, read its latest annual report. Search it with search_report using the words an annual report would use, and list its risks with risk_headings.
- Each paragraph comes with the headings it sits under. A report discusses its year in management's discussion: its overview or highlights, and its results of operations, where it says why its revenue changed. Asked about its year, give those reasons in its words.
- Results hold whole paragraphs, so answer from them without reading the report again. Make every report lookup in one exec call: run several searches together, and when one finds nothing useful, search again with other words in the same code.
- Search the report before saying the tool cannot answer a question about what the company does or says, and when a figure the question is about is a gap: a company that has never paid a dividend, for instance, says so in its report.
- When a total jumps or falls in one year, search the report for why, such as a special dividend, before describing a trend.
- Before saying the report names no rivals, search for the lists where reports name them, such as compet* NEAR(include, 5) or "such as". When it names none, say so, and say how it describes its competition.

Words
- Use the glossary's words: revenue, not sales; net income, not profit or earnings; fiscal 2026, not FY26. Net income is what is left of each dollar, never what the company keeps. ${otherNames}
- Say what happened. No judgement of the company, no forecast and no advice on buying or selling. If asked whether to buy, or whether the shares are cheap, say the tool cannot tell, because it has no share prices and makes no forecasts, then say what the figures show about the business.
- If neither the lookups nor the annual report can answer, say so in the lead and name what the tool does not collect, from the notes of the company lookup, and give no figures. Never answer from memory.

Answer
Reply with JSON that matches the schema:
- lead: one short sentence that answers the question.
- sentences: one to three short sentences with the figures behind it.
- quotes: when the answer uses the annual report, one or two passages it rests on, such as the risk headings it names, each copied character for character from a report lookup's result; otherwise none.
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
    ...already.flatMap((read) => figuresOf(read.result).map((text) => ({ text, source: read.id }))),
    ...live.flatMap((result) => figuresOf(result).map((text) => ({ text, source: "live" }))),
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
      quotes: Array.isArray(parsed.quotes)
        ? parsed.quotes.map((text) => ({ text: String(text), source: "", url: "" }))
        : [],
      drawing: typeof parsed.drawing === "string" && parsed.drawing !== "" ? parsed.drawing : null,
      next: Array.isArray(parsed.next) ? parsed.next.map(String).slice(0, 3) : [],
    };
  } catch {
    return null;
  }
};

const plain = (text: string) =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/^["'…\s]+|["'…\s]+$/g, "");

// A quote is shown only when its words are in a paragraph a report lookup
// returned during this answer, so the agent cannot put words in a company's mouth.
export const checkQuotes = (answer: Answer, live: ReadonlyArray<LookupResult>): Answer => {
  const passages = live
    .filter((result) => isReportLookup(result.lookup))
    .flatMap((result) =>
      Object.values(result.figures).map((text) => ({ text: plain(text), result })),
    );
  const quotes = (answer.quotes ?? []).flatMap((quote) => {
    const wanted = plain(quote.text);
    const found = passages.find((passage) => wanted.length > 0 && passage.text.includes(wanted));
    const filing = found?.result.filings[0];
    return found === undefined || filing === undefined
      ? []
      : [{ text: wanted, source: found.result.title, url: filing.url }];
  });
  return { ...answer, quotes: quotes.slice(0, 2) };
};

type Usage = {
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
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
      // A finished question's thread, and the lookups program it started, ends
      // soon after. The spare thread stays, since the tool is still subscribed to it.
      thread_unload_delay_secs: 30,
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

export const readUpFront = <E, R>(
  companies: ReadonlyArray<{ readonly ticker: string }>,
  fiscalYear: number | null,
  read: (name: string, input: unknown) => Effect.Effect<LookupReply, E, R>,
) =>
  Effect.gen(function* () {
    const wanted = companies.flatMap((company) =>
      upFront(company.ticker, fiscalYear).map((each) => ({
        ...each,
        ticker: company.ticker,
      })),
    );
    const replies = yield* Effect.forEach(
      wanted,
      (each) =>
        read(each.lookup, each.input).pipe(
          Effect.catch((error) =>
            Effect.logWarning(
              `The ${each.lookup} lookup for ${each.ticker} could not be read before the question`,
              error,
            ).pipe(Effect.as(null)),
          ),
        ),
      { concurrency: "unbounded" },
    );
    return wanted.flatMap((each, index): ReadonlyArray<Prefetched> => {
      const reply = replies[index];
      return reply != null && "result" in reply
        ? [{ id: `${each.ticker}-${each.lookup}`, ...each, result: reply.result }]
        : [];
    });
  });

export class SettingsRefused extends Data.TaggedError("SettingsRefused")<{
  readonly reason: string;
}> {
  override get message() {
    return this.reason;
  }
}

export class AnswerUnreadable extends Data.TaggedError("AnswerUnreadable")<{}> {
  override get message() {
    return "The answer came back in a shape the tool cannot read.";
  }
}

const TurnStarted = Schema.Struct({ turn: Schema.Struct({ id: Schema.String }) });

// The running Codex, started with the reader's settings if it is not running.
const connectionFor = (lookupsUrl: string) =>
  Effect.gen(function* () {
    const configured = settingsFor(lookupsUrl, yield* Effect.sync(() => readReaderConfig()));
    if ("refused" in configured) return yield* new SettingsRefused({ reason: configured.refused });
    const agent = yield* Agent;
    return yield* agent.connection(flagsFor(configured.settings));
  });

// Starts Codex and a spare thread before the first question, so it waits less.
export const warm = (lookupsUrl: string) =>
  connectionFor(lookupsUrl).pipe(
    Effect.flatMap((connection) => connection.warm),
    Effect.catch((error) => Effect.logWarning("Codex could not be warmed up", error)),
  );

// A request whose reply nobody waits for: the answer is already finished.
const inBackground = (connection: Connection, method: string, params: unknown) =>
  connection.request(method, params).pipe(
    Effect.catch((error) => Effect.logDebug(`Codex did not take ${method}`, error)),
    Effect.forkDetach,
    Effect.asVoid,
  );

export type AskInput<E, R> = {
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
  readonly read: (name: string, input: unknown) => Effect.Effect<LookupReply, E, R>;
};

// The events of one answer, ending with the answer or with why there is none.
// Stopping the stream stops Codex's turn.
export const ask = <E, R>(input: AskInput<E, R>): Stream.Stream<AskEvent, never, Agent | R> =>
  Stream.callback<AskEvent, never, Agent | R>((queue) => {
    const emit = (event: AskEvent) =>
      Effect.gen(function* () {
        if (event.type === "failed") {
          yield* Effect.logWarning(`The answer failed: ${event.message}`);
        }
        yield* Queue.offer(queue, event);
      });

    const answer = Effect.gen(function* () {
      // Codex starts while the figures are read. A thread or turn that Codex
      // starts is always let go of, even when the reader leaves while it starts.
      const [[connection, thread], already] = yield* Effect.all(
        [
          Effect.gen(function* () {
            const connection = yield* connectionFor(input.lookupsUrl);
            const thread = yield* Effect.acquireRelease(connection.thread, (id) =>
              inBackground(connection, "thread/unsubscribe", { threadId: id }),
            );
            return [connection, thread] as const;
          }),
          readUpFront(input.companies, input.fiscalYear, input.read),
        ],
        { concurrency: 2 },
      );
      const { next } = yield* connection.listen(thread);

      let finished = false;
      yield* Effect.acquireRelease(
        connection
          .request("turn/start", {
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
          })
          .pipe(
            Effect.flatMap((started) =>
              Schema.decodeUnknownEffect(TurnStarted)(started).pipe(
                Effect.mapError((cause) => new CodexUnexpected({ method: "turn/start", cause })),
              ),
            ),
          ),
        (started) =>
          finished
            ? Effect.void
            : inBackground(connection, "turn/interrupt", {
                threadId: thread,
                turnId: started.turn.id,
              }),
      );

      let trips = 0;
      let usage: Usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
      const counted = (notification: Notification) => {
        if (notification.method !== "thread/tokenUsage/updated") return false;
        trips += 1;
        const total = (notification.params.tokenUsage as { readonly total?: Usage } | undefined)
          ?.total;
        if (total !== undefined) {
          usage = {
            inputTokens: total.inputTokens,
            cachedInputTokens: total.cachedInputTokens,
            outputTokens: total.outputTokens,
          };
        }
        return true;
      };
      const live: Array<LookupResult> = [];
      while (true) {
        const notification = yield* next;
        if (notification.method === "turn/completed") {
          finished = true;
          const error = (
            notification.params.turn as { readonly error?: { readonly message?: string } | null }
          ).error;
          if (error?.message !== undefined) return yield* emit(failed(error.message));
          return yield* new AnswerUnreadable();
        }
        if (counted(notification)) continue;
        const event = toEvent(notification);
        if (event === null) continue;
        // A failure, including a step outside the lookups, ends the answer.
        if (event.type === "failed") return yield* emit(event);
        if (event.type === "read" && event.result !== null) live.push(event.result);
        if (event.type === "answer") {
          const checked = checkQuotes(event.answer, live);
          for (const read of usedBy(checked, already, live)) {
            yield* emit({
              type: "reading",
              id: read.id,
              lookup: read.lookup,
              input: read.input,
            });
            yield* emit({
              type: "read",
              id: read.id,
              lookup: read.lookup,
              result: read.result,
              error: null,
            });
          }
          yield* emit({ type: "answer", answer: checked });
          // The last trip's tokens arrive after the answer, which is already on
          // screen, so they are counted while the turn finishes.
          yield* Effect.gen(function* () {
            while (!finished) {
              const later = yield* next;
              if (later.method === "turn/completed") finished = true;
              else counted(later);
            }
          }).pipe(
            Effect.timeoutOption("3 seconds"),
            Effect.catch((error) =>
              Effect.logDebug("Codex stopped while the tokens were counted", error),
            ),
          );
          yield* emit({ type: "usage", trips, ...usage });
          return;
        }
        yield* emit(event);
      }
    });

    return answer.pipe(
      Effect.catch((error) => emit(failed(error))),
      Effect.catchDefect((defect) =>
        Effect.logError("The answer broke", defect).pipe(Effect.andThen(emit(failed(defect)))),
      ),
      Effect.andThen(Queue.end(queue)),
    );
  });
