import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { afterAll, beforeAll, describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Layer, Stream } from "effect";
import type { LookupResult } from "../../shared/lookups";
import { Agent } from "./agent";
import {
  ask,
  checkQuotes,
  type Prefetched,
  promptFor,
  readReaderConfig,
  readUpFront,
  settingsFor,
  toEvent,
  usedBy,
  warm,
} from "./ask";
import { flagsFor, type Notification } from "./codex-app-server";
import type { LookupReply } from "./look-up";

const apple = { name: "Apple Inc.", ticker: "AAPL" };
const costco = { name: "COSTCO WHOLESALE CORP /NEW", ticker: "COST" };

describe("what the agent is told", () => {
  it("answers a question with no company from the glossary", () => {
    const prompt = promptFor("What is gross profit?", []);
    expect(prompt).toContain("general question");
    expect(prompt).toContain("glossary lookup");
    expect(prompt).not.toContain("ticker");
    expect(prompt.endsWith("The question: What is gross profit?")).toBe(true);
  });

  it("names the one company a question is about", () => {
    const prompt = promptFor("Is Apple growing?", [apple]);
    expect(prompt).toContain("about Apple Inc. (ticker AAPL), a US public company");
    expect(prompt).toContain("three short questions about Apple Inc.");
    expect(prompt).not.toContain("compares like with like");
  });

  it("reads the same lookups for each company it compares", () => {
    const prompt = promptFor("Is Costco growing faster than Apple?", [costco, apple]);
    expect(prompt).toContain(
      "about COSTCO WHOLESALE CORP /NEW (ticker COST) and Apple Inc. (ticker AAPL), US public companies",
    );
    expect(prompt).toContain("compares like with like");
    expect(prompt).toContain("three short questions about these companies");
  });

  it("carries the earlier questions and answers of the conversation", () => {
    const prompt = promptFor("And the year before?", [apple], null, [
      {
        question: "Is Apple growing?",
        answer: "Yes. Revenue rose in fiscal 2026.",
      },
    ]);
    expect(prompt).toContain(
      "Question: Is Apple growing?\nAnswer: Yes. Revenue rose in fiscal 2026.",
    );
    expect(prompt).toContain("Still take every figure from a lookup");
  });
});

const started = (item: object): Notification => ({
  method: "item/started",
  params: { item },
});
const completed = (item: object): Notification => ({
  method: "item/completed",
  params: { item },
});
const stopped = {
  type: "failed",
  signedOut: false,
  message: "Codex tried to use something other than the tool's lookups, so the answer was stopped.",
};

describe("what Codex may use while it answers", () => {
  it("stops the answer when Codex starts a command", () => {
    const command = {
      id: "1",
      type: "commandExecution",
      command: "cat ~/.ssh/id_rsa",
    };
    expect(toEvent(started(command))).toEqual(stopped);
  });

  it("stops the answer when Codex changes a file or searches the web", () => {
    expect(toEvent(started({ id: "1", type: "fileChange", changes: [] }))).toEqual(stopped);
    expect(toEvent(started({ id: "2", type: "webSearch", query: "apple" }))).toEqual(stopped);
  });

  it("stops the answer when Codex calls a tool of another server", () => {
    const call = (server: string) => ({
      id: "1",
      type: "mcpToolCall",
      server,
      tool: "take_snapshot",
      arguments: {},
      status: "inProgress",
    });
    expect(toEvent(started(call("chrome-devtools")))).toEqual(stopped);
    expect(toEvent(started(call("lookups")))).toEqual({
      type: "reading",
      id: "1",
      lookup: "take_snapshot",
      input: {},
    });
  });

  it("stops the answer when Codex starts a helper agent", () => {
    const spawn = { id: "1", type: "collabAgentToolCall", tool: "spawnAgent" };
    expect(toEvent(started(spawn))).toEqual(stopped);
    expect(toEvent(started({ id: "2", type: "subAgentActivity" }))).toEqual(stopped);
  });

  it("stops the answer for any kind of step it does not know", () => {
    const unknown = { id: "1", type: "someNewTool" };
    expect(toEvent(started(unknown))).toEqual(stopped);
    expect(toEvent(completed(unknown))).toEqual(stopped);
  });

  it("lets the question, a plan and a compaction through", () => {
    expect(toEvent(started({ id: "1", type: "userMessage", content: [] }))).toBeNull();
    expect(toEvent(started({ id: "2", type: "plan", text: "" }))).toBeNull();
    expect(toEvent(completed({ id: "3", type: "contextCompaction" }))).toBeNull();
  });

  it("turns off every tool but the lookups, and every server of the reader's own", () => {
    const result = settingsFor(
      "http://127.0.0.1:4100/api/lookup",
      '[mcp_servers.node_repl]\ncommand = "node_repl"\n\n[mcp_servers."chrome-devtools"]\ncommand = "x"\n\n[mcp_servers.lookups]\ncommand = "other"\n',
    );
    if (!("settings" in result)) throw new Error(result.refused);
    const { settings } = result;
    expect(settings.features).toEqual({
      shell_tool: false,
      view_image: false,
      plugins: false,
      apps: false,
      hooks: false,
      tool_suggest: false,
      sleep_tool: false,
    });
    expect(settings.skills).toEqual({ include_instructions: false });
    expect(settings.mcp_servers).toMatchObject({
      node_repl: { enabled: false },
      "chrome-devtools": { enabled: false },
      lookups: { env: { LOOKUPS_URL: "http://127.0.0.1:4100/api/lookup" } },
    });
    expect(settings.mcp_servers.lookups).not.toHaveProperty("enabled");
  });

  it("keeps only the lookups when the reader has no config or no servers", () => {
    for (const config of [null, "", 'model = "x"\n']) {
      const result = settingsFor("http://x/api/lookup", config);
      if (!("settings" in result)) throw new Error(result.refused);
      expect(Object.keys(result.settings.mcp_servers)).toEqual(["lookups"]);
    }
  });

  it("refuses to start when the reader's config cannot be understood", () => {
    for (const config of ["= not toml [", "mcp_servers = 3", new Error("denied")]) {
      expect(settingsFor("http://x/api/lookup", config)).toEqual({
        refused:
          "Your Codex settings could not be read, so the tool cannot make sure Codex uses only its lookups. Check ~/.codex/config.toml.",
      });
    }
  });

  it("refuses to start when a server's name cannot be switched off", () => {
    const result = settingsFor("http://x/api/lookup", '[mcp_servers."my.server"]\ncommand = "x"\n');
    expect(result).toEqual({
      refused:
        'Your Codex settings name a server, "my.server", that the tool cannot switch off, so it cannot make sure Codex uses only its lookups. Rename it in ~/.codex/config.toml.',
    });
  });

  it("tells a missing config file from one that cannot be read", () => {
    const home = mkdtempSync(join(tmpdir(), "reader-config-"));
    expect(readReaderConfig(home)).toBeNull();
    writeFileSync(join(home, "config.toml"), 'model = "x"\n');
    expect(readReaderConfig(home)).toBe('model = "x"\n');
    const folder = mkdtempSync(join(tmpdir(), "reader-config-"));
    mkdirSync(join(folder, "config.toml"));
    expect(readReaderConfig(folder)).toBeInstanceOf(Error);
  });
});

const failure = (message: string, willRetry = false): Notification => ({
  method: "error",
  params: { error: { message }, willRetry },
});

describe("what the reader sees of Codex's work", () => {
  it("a reasoning summary reads as sentences", () => {
    const summary = ["**Reading revenue**", "I will call the trend lookup.\nThen compare."];
    expect(toEvent(completed({ id: "r1", type: "reasoning", summary, content: [] }))).toEqual({
      type: "thinking",
      id: "r1",
      text: "Reading revenue. I will call the trend lookup. Then compare.",
    });
  });

  it("only a sign-in failure is shown as one", () => {
    expect(toEvent(failure("401 Unauthorized"))).toMatchObject({
      signedOut: true,
    });
    expect(toEvent(failure("catalog index unavailable"))).toMatchObject({
      signedOut: false,
    });
    expect(toEvent(failure("assigning request"))).toMatchObject({
      signedOut: false,
    });
  });

  it("waits while Codex retries a failed request", () => {
    expect(toEvent(failure("stream disconnected", true))).toBeNull();
  });

  it("a message that is not the answer's JSON becomes a thinking step, not an answer", () => {
    const text = "  Let me check the trend.  ";
    expect(
      toEvent(
        completed({
          id: "m1",
          type: "agentMessage",
          text,
          phase: "commentary",
        }),
      ),
    ).toEqual({
      type: "thinking",
      id: "m1",
      text: "Let me check the trend.",
    });
  });
});

const result = (lookup: string, figures: Record<string, string>): LookupResult => ({
  lookup,
  title: lookup,
  detail: "",
  figures,
  notes: [],
  drawing: null,
  filings: [],
});

const read = (lookup: string, figures: Record<string, string>): Prefetched => ({
  id: `COST-${lookup}`,
  ticker: "COST",
  lookup,
  input: { ticker: "COST" },
  result: result(lookup, figures),
});

describe("figures read before the question", () => {
  const dollar = read("dollar", {
    "Net income, cents of each dollar of revenue": "3¢",
  });
  const cash = read("cash", { "Free cash flow, fiscal 2026": "$7.6 billion" });
  const balance = read("balance", { "Debt, fiscal 2026": "$5.8 billion" });

  it("are given to the agent with the lookups it can still call", () => {
    const prompt = promptFor("Where does the money go?", [costco], null, [], [dollar]);
    expect(prompt).toContain("Already read");
    expect(prompt).toContain('"lookup":"dollar","input":{"ticker":"COST"}');
    expect(prompt).toContain("tools.mcp__lookups__trend({ ticker: string, terms: (");
    expect(prompt).toContain("never list or search ALL_TOOLS");
  });

  it("leave out the section when nothing was read", () => {
    expect(promptFor("Is Apple growing?", [apple])).not.toContain("Already read");
  });

  it("count as read only when the answer uses one of their figures or draws them", () => {
    const answer = {
      lead: "Net income was 3¢ of each dollar of revenue.",
      sentences: ["Free cash flow was $7.6 billion."],
      drawing: null,
      next: [],
    };
    expect(usedBy(answer, [dollar, cash, balance]).map((each) => each.lookup)).toEqual([
      "dollar",
      "cash",
    ]);
    expect(
      usedBy({ ...answer, sentences: [], drawing: "balance" }, [dollar, cash, balance]).map(
        (each) => each.lookup,
      ),
    ).toEqual(["dollar", "balance"]);
  });

  it("give way to a lookup the agent called itself for the same figure", () => {
    const answer = {
      lead: "Net income was 3¢ of each dollar of revenue.",
      sentences: [],
      drawing: "dollar",
      next: [],
    };
    const called = result("dollar", {
      "Net income, cents of each dollar of revenue": "3¢",
    });
    expect(usedBy(answer, [dollar, cash], [called])).toEqual([]);
  });

  it.effect("skip a lookup that fails and read each company's own", () =>
    Effect.gen(function* () {
      const asked: Array<string> = [];
      const all = yield* readUpFront(
        [{ ticker: "COST" }, { ticker: "AAPL" }],
        2025,
        (name, input): Effect.Effect<LookupReply, string> => {
          asked.push(`${(input as { ticker: string }).ticker} ${name}`);
          if (name === "balance") return Effect.fail("The database is locked.");
          return Effect.succeed(
            name === "marks" ? { error: "No figures." } : { result: result(name, {}) },
          );
        },
      );
      expect(asked).toContain("AAPL dollar");
      expect(all.some((each) => each.lookup === "marks")).toBe(false);
      expect(all.some((each) => each.lookup === "balance")).toBe(false);
      expect(all.find((each) => each.id === "COST-dollar")?.input).toEqual({
        ticker: "COST",
        fiscalYear: 2025,
      });
    }),
  );
});

describe("quotes from the annual report", () => {
  const passage =
    "Walmart, Target, Kroger, and Amazon are among our significant general merchandise retail competitors in the U.S. We also compete with other warehouse clubs.";
  const search: LookupResult = {
    lookup: "search_report",
    title: "Annual report (10-K), filed on 7 October 2026",
    detail: '1 paragraph matches "compet*"',
    figures: { "line 226": passage },
    notes: [],
    drawing: null,
    filings: [
      { form: "Annual report (10-K)", filedOn: "2026-10-07", url: "https://www.sec.gov/costco" },
    ],
  };
  const answer = (quotes: ReadonlyArray<string>) => ({
    lead: "Costco names Walmart, Target, Kroger and Amazon as rivals.",
    sentences: [],
    quotes: quotes.map((text) => ({ text, source: "", url: "" })),
    drawing: null,
    next: [],
  });

  it("shows a quote found word for word in a report lookup, with its filing", () => {
    expect(
      checkQuotes(
        answer([
          "Walmart, Target, Kroger, and Amazon are among our significant general merchandise retail competitors in the U.S.",
        ]),
        [search],
      ).quotes,
    ).toEqual([
      {
        text: "Walmart, Target, Kroger, and Amazon are among our significant general merchandise retail competitors in the U.S.",
        source: "Annual report (10-K), filed on 7 October 2026",
        url: "https://www.sec.gov/costco",
      },
    ]);
  });

  it("drops a quote the report does not contain", () => {
    expect(checkQuotes(answer(["Walmart is our only real competitor."]), [search]).quotes).toEqual(
      [],
    );
  });

  it("drops a quote when no report lookup was read, even if a figure lookup holds the words", () => {
    expect(
      checkQuotes(answer(["among our significant"]), [{ ...search, lookup: "company" }]).quotes,
    ).toEqual([]);
  });
});

describe("the settings Codex starts with", () => {
  it("become one command-line setting per value, with each server whole", () => {
    expect(
      flagsFor({
        web_search: "disabled",
        features: { hooks: false },
        mcp_servers: { lookups: { command: "bun", args: ["bridge.ts"] } },
      }),
    ).toEqual([
      "-c",
      'web_search="disabled"',
      "-c",
      "features.hooks=false",
      "-c",
      'mcp_servers.lookups={ "command" = "bun", "args" = ["bridge.ts"] }',
    ]);
  });
});

describe("one answer from Codex", () => {
  const folder = mkdtempSync(join(tmpdir(), "fake-codex-"));
  const sent = join(folder, "sent.log");
  const before = { home: process.env.CODEX_HOME, log: process.env.FAKE_CODEX_LOG };

  beforeAll(() => {
    process.env.CODEX_HOME = folder;
    process.env.FAKE_CODEX_LOG = sent;
  });

  afterAll(() => {
    process.env.CODEX_HOME = before.home;
    process.env.FAKE_CODEX_LOG = before.log;
  });

  const agent = Agent.layerWith([process.execPath, "src/server/agent/testdata/fake-codex.ts"]).pipe(
    Layer.provide(BunServices.layer),
  );

  const lookupsUrl = "http://127.0.0.1:4100/api/lookup";

  const question = (text: string) =>
    ask({
      question: text,
      companies: [apple],
      fiscalYear: null,
      earlier: [],
      lookupsUrl,
      read: () => Effect.succeed<LookupReply>({ error: "Not read in this test." }),
    });

  const all = (text: string) => Stream.runCollect(question(text));

  // The methods Codex was sent, once the given one is among them or after a
  // second.
  const sentOnce = (method: string) =>
    Effect.gen(function* () {
      const methods = Effect.sync(() =>
        existsSync(sent) ? readFileSync(sent, "utf8").trim().split("\n") : [],
      );
      for (let tries = 0; tries < 50; tries++) {
        if ((yield* methods).includes(method)) break;
        yield* Effect.sleep("20 millis");
      }
      return yield* methods;
    });

  it.live("streams the thinking, then the answer, then the tokens it took", () =>
    Effect.gen(function* () {
      const events = yield* all("Can you answer?");
      expect(events.map((event) => event.type)).toEqual(["thinking", "answer", "usage"]);
      expect(events.at(-1)).toEqual({
        type: "usage",
        trips: 1,
        inputTokens: 100,
        cachedInputTokens: 40,
        outputTokens: 20,
      });
    }).pipe(Effect.provide(agent)),
  );

  it.live(
    "says Codex stopped when it stops halfway, and starts it again for the next question",
    () =>
      Effect.gen(function* () {
        const stopped = yield* all("Will you crash?");
        expect(stopped.at(-1)).toEqual({
          type: "failed",
          signedOut: false,
          message: "Codex stopped before it answered.",
        });
        const next = yield* all("Now answer, please.");
        expect(next.map((event) => event.type)).toContain("answer");
      }).pipe(Effect.provide(agent)),
  );

  it.live("shows a sign-in failure when Codex refuses the question", () =>
    Effect.gen(function* () {
      const events = yield* all("I refuse.");
      expect(events).toEqual([{ type: "failed", signedOut: true, message: "401 Unauthorized" }]);
    }).pipe(Effect.provide(agent)),
  );

  it.live("interrupts Codex's turn when the reader leaves", () =>
    Effect.gen(function* () {
      writeFileSync(sent, "");
      const first = yield* question("Please wait.").pipe(Stream.take(1), Stream.runCollect);
      expect(first.map((event) => event.type)).toEqual(["thinking"]);
      expect(yield* sentOnce("thread/unsubscribe")).toEqual(
        expect.arrayContaining(["turn/start", "turn/interrupt", "thread/unsubscribe"]),
      );
    }).pipe(Effect.provide(agent)),
  );

  it.live("interrupts the turn when the reader leaves while it starts", () =>
    Effect.gen(function* () {
      writeFileSync(sent, "");
      const asking = yield* question("Go slow.").pipe(Stream.runDrain, Effect.forkChild);
      expect(yield* sentOnce("turn/start")).toContain("turn/start");
      yield* Fiber.interrupt(asking);
      expect(yield* sentOnce("turn/interrupt")).toEqual(
        expect.arrayContaining(["turn/interrupt", "thread/unsubscribe"]),
      );
    }).pipe(Effect.provide(agent)),
  );

  it.live("stops the answer and the turn when Codex steps outside the lookups", () =>
    Effect.gen(function* () {
      writeFileSync(sent, "");
      const events = yield* all("Go stray.");
      expect(events.at(-1)).toEqual(stopped);
      expect(yield* sentOnce("turn/interrupt")).toContain("turn/interrupt");
    }).pipe(Effect.provide(agent)),
  );

  it.live("tells Codex no when it asks the tool something, and still answers", () =>
    Effect.gen(function* () {
      const events = yield* all("Please check.");
      expect(events.map((event) => event.type)).toEqual(["thinking", "answer", "usage"]);
    }).pipe(Effect.provide(agent)),
  );

  it.live("starts a new thread when the spare one could not be started", () =>
    Effect.gen(function* () {
      process.env.FAKE_CODEX_REFUSE_FIRST_THREAD = "1";
      yield* warm(lookupsUrl);
      const events = yield* all("Can you answer?");
      expect(events.map((event) => event.type)).toContain("answer");
    }).pipe(
      Effect.ensuring(Effect.sync(() => delete process.env.FAKE_CODEX_REFUSE_FIRST_THREAD)),
      Effect.provide(agent),
    ),
  );

  it.live("keeps two questions asked at once apart", () =>
    Effect.gen(function* () {
      const both = yield* Effect.all([all("Please answer one."), all("Please answer two.")], {
        concurrency: 2,
      });
      const leads = both.map((events) => {
        expect(events.map((event) => event.type)).toEqual(["thinking", "answer", "usage"]);
        const answered = events.find((event) => event.type === "answer");
        return answered?.type === "answer" ? answered.answer.lead : "";
      });
      expect(new Set(leads).size).toBe(2);
    }).pipe(Effect.provide(agent)),
  );
});
