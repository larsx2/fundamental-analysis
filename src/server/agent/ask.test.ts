import { describe, expect, it } from "@effect/vitest";
import type { ThreadEvent } from "@openai/codex-sdk";
import { promptFor, settingsFor, toEvent } from "./ask";

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

const started = (item: object) => ({ type: "item.started", item }) as ThreadEvent;
const stopped = {
  type: "failed",
  signedOut: false,
  message: "Codex tried to use something other than the tool's lookups, so the answer was stopped.",
};

describe("what Codex may use while it answers", () => {
  it("stops the answer when Codex starts a command", () => {
    const command = {
      id: "1",
      type: "command_execution",
      command: "cat ~/.ssh/id_rsa",
      aggregated_output: "",
      status: "in_progress",
    };
    expect(toEvent(started(command))).toEqual(stopped);
  });

  it("stops the answer when Codex changes a file or searches the web", () => {
    const change = { id: "1", type: "file_change", changes: [], status: "completed" };
    expect(toEvent(started(change))).toEqual(stopped);
    expect(toEvent(started({ id: "2", type: "web_search", query: "apple" }))).toEqual(stopped);
  });

  it("stops the answer when Codex calls a tool of another server", () => {
    const call = (server: string) => ({
      id: "1",
      type: "mcp_tool_call",
      server,
      tool: "take_snapshot",
      arguments: {},
      status: "in_progress",
    });
    expect(toEvent(started(call("chrome-devtools")))).toEqual(stopped);
    expect(toEvent(started(call("lookups")))).toEqual({
      type: "reading",
      id: "1",
      lookup: "take_snapshot",
      input: {},
    });
  });

  it("turns off every tool but the lookups, and every server of the reader's own", () => {
    const settings = settingsFor(
      "http://127.0.0.1:4100/api/lookup",
      '[mcp_servers.node_repl]\ncommand = "node_repl"\n\n[mcp_servers.lookups]\ncommand = "other"\n',
    );
    expect(settings.features).toEqual({
      shell_tool: false,
      view_image: false,
      plugins: false,
      apps: false,
    });
    expect(settings.mcp_servers).toMatchObject({
      node_repl: { enabled: false },
      lookups: { env: { LOOKUPS_URL: "http://127.0.0.1:4100/api/lookup" } },
    });
    expect(settings.mcp_servers.lookups).not.toHaveProperty("enabled");
  });

  it("keeps only the lookups when the reader's config is missing or unreadable", () => {
    expect(Object.keys(settingsFor("http://x/api/lookup", null).mcp_servers)).toEqual(["lookups"]);
    expect(Object.keys(settingsFor("http://x/api/lookup", "= not toml [").mcp_servers)).toEqual([
      "lookups",
    ]);
  });
});

const completed = (item: Record<string, unknown>) =>
  ({ type: "item.completed", item }) as unknown as ThreadEvent;

const failure = (message: string) =>
  ({ type: "turn.failed", error: { message } }) as unknown as ThreadEvent;

describe("what the reader sees of Codex's work", () => {
  it("a reasoning summary reads as sentences", () => {
    const text = "**Reading revenue**\n\nI will call the trend lookup.\nThen compare.";
    expect(toEvent(completed({ id: "r1", type: "reasoning", text }))).toEqual({
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

  it("a message that is not the answer's JSON becomes a thinking step, not an answer", () => {
    const text = "  Let me check the trend.  ";
    expect(toEvent(completed({ id: "m1", type: "agent_message", text }))).toEqual({
      type: "thinking",
      id: "m1",
      text: "Let me check the trend.",
    });
  });
});
