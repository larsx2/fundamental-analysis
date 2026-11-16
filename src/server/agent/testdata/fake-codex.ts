// Stands in for Codex's app server in tests. It writes each method it is sent
// to the file named by FAKE_CODEX_LOG, and what it does with a turn depends on
// a word in the question:
// - "answer" answers at once
// - "crash" stops the program halfway
// - "wait" thinks once and then waits until the turn is interrupted
// - "slow" waits before it starts the turn, then thinks and waits
// - "refuse" refuses to start the turn
// - "stray" starts a command, which the tool does not allow
// - "check" asks the tool something first, and answers once it is told no
// With FAKE_CODEX_REFUSE_FIRST_THREAD set, the first thread it is asked for
// is refused.
import { appendFileSync } from "node:fs";

const log = process.env.FAKE_CODEX_LOG;

const send = (message: object) => process.stdout.write(`${JSON.stringify(message)}\n`);

let threads = 0;
// The turn waiting for the tool to reply to Codex's own request.
let checking: (() => void) | null = null;

for await (const line of console) {
  if (line.trim() === "") continue;
  const message = JSON.parse(line) as {
    readonly id?: number;
    readonly method?: string;
    readonly params?: Record<string, unknown>;
    readonly error?: unknown;
  };
  if (log !== undefined && message.method !== undefined) {
    appendFileSync(log, `${message.method}\n`);
  }
  if (message.method === undefined) {
    // The tool's reply to a request of Codex's own.
    if (message.error !== undefined) checking?.();
    checking = null;
    continue;
  }
  const reply = (result: unknown) => send({ id: message.id, result });
  const threadId = message.params?.threadId;
  const notify = (method: string, params: object) =>
    send({ method, params: { threadId, ...params } });
  const think = () =>
    notify("item/completed", {
      item: { id: "r1", type: "reasoning", summary: ["Reading revenue"] },
    });
  const answer = () => {
    const text = JSON.stringify({
      lead: `Revenue grew in ${String(threadId)}.`,
      sentences: ["Revenue was $416 billion."],
      quotes: [],
      drawing: "",
      next: [],
    });
    notify("item/completed", { item: { id: "m1", type: "agentMessage", text } });
    notify("thread/tokenUsage/updated", {
      tokenUsage: { total: { inputTokens: 100, cachedInputTokens: 40, outputTokens: 20 } },
    });
    notify("turn/completed", { turn: { id: "turn-1", error: null } });
  };

  switch (message.method) {
    case "initialize":
      reply({});
      break;
    case "thread/start":
      threads += 1;
      if (threads === 1 && process.env.FAKE_CODEX_REFUSE_FIRST_THREAD !== undefined) {
        send({ id: message.id, error: { message: "Still loading." } });
        break;
      }
      reply({ thread: { id: `thread-${threads}` } });
      break;
    case "turn/start": {
      const input = message.params?.input as ReadonlyArray<{
        readonly text: string;
      }>;
      const question = input[0]?.text.split("The question: ").at(-1) ?? "";
      if (question.includes("refuse")) {
        send({ id: message.id, error: { message: "401 Unauthorized" } });
        break;
      }
      if (question.includes("slow")) {
        setTimeout(() => {
          reply({ turn: { id: "turn-1" } });
          think();
        }, 300);
        break;
      }
      reply({ turn: { id: "turn-1" } });
      think();
      if (question.includes("crash")) process.exit(1);
      if (question.includes("stray")) {
        notify("item/started", {
          item: { id: "c1", type: "commandExecution", command: "ls" },
        });
      }
      if (question.includes("check")) {
        checking = answer;
        send({ id: 900, method: "item/tool/requestUserInput", params: { threadId } });
      }
      if (question.includes("answer")) answer();
      break;
    }
    case "turn/interrupt":
      reply({});
      notify("turn/completed", { turn: { id: "turn-1", error: null } });
      break;
    default:
      if (message.id !== undefined) reply({});
  }
}
