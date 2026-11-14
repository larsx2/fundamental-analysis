import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { LookupResult } from "../../shared/lookups";
import {
  type Prefetched,
  promptFor,
  readReaderConfig,
  readUpFront,
  settingsFor,
  toEvent,
  usedBy,
} from "./ask";
import { flagsFor, type Notification } from "./codex-app-server";

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
      { question: "Is Apple growing?", answer: "Yes. Revenue rose in fiscal 2026." },
    ]);
    expect(prompt).toContain(
      "Question: Is Apple growing?\nAnswer: Yes. Revenue rose in fiscal 2026.",
    );
    expect(prompt).toContain("Still take every figure from a lookup");
  });
});

const started = (item: object): Notification => ({ method: "item/started", params: { item } });
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
    const command = { id: "1", type: "commandExecution", command: "cat ~/.ssh/id_rsa" };
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
    expect(toEvent(failure("401 Unauthorized"))).toMatchObject({ signedOut: true });
    expect(toEvent(failure("catalog index unavailable"))).toMatchObject({ signedOut: false });
    expect(toEvent(failure("assigning request"))).toMatchObject({ signedOut: false });
  });

  it("waits while Codex retries a failed request", () => {
    expect(toEvent(failure("stream disconnected", true))).toBeNull();
  });

  it("a message that is not the answer's JSON becomes a thinking step, not an answer", () => {
    const text = "  Let me check the trend.  ";
    expect(
      toEvent(completed({ id: "m1", type: "agentMessage", text, phase: "commentary" })),
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
  const dollar = read("dollar", { "Net income, cents of each dollar of revenue": "3¢" });
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
    const called = result("dollar", { "Net income, cents of each dollar of revenue": "3¢" });
    expect(usedBy(answer, [dollar, cash], [called])).toEqual([]);
  });

  it("skip a lookup that fails and read each company's own", async () => {
    const asked: Array<string> = [];
    const all = await readUpFront([{ ticker: "COST" }, { ticker: "AAPL" }], 2025, (name, input) => {
      asked.push(`${(input as { ticker: string }).ticker} ${name}`);
      return Promise.resolve(
        name === "marks" ? { error: "No figures." } : { result: result(name, {}) },
      );
    });
    expect(asked).toContain("AAPL dollar");
    expect(all.some((each) => each.lookup === "marks")).toBe(false);
    expect(all.find((each) => each.id === "COST-dollar")?.input).toEqual({
      ticker: "COST",
      fiscalYear: 2025,
    });
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
