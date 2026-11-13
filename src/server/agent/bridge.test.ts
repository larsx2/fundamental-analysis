import { afterAll, describe, expect, it } from "@effect/vitest";

const tool = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  fetch: () => new Response("<h1>Internal Server Error</h1>", { status: 500 }),
});

afterAll(() => tool.stop(true));

type Reply = {
  readonly id: number | null;
  readonly result?: {
    readonly isError?: boolean;
    readonly content?: ReadonlyArray<{ readonly text: string }>;
    readonly tools?: ReadonlyArray<unknown>;
  };
  readonly error?: { readonly code: number };
};

const send = async (lines: ReadonlyArray<string>) => {
  const bridge = Bun.spawn([process.execPath, "src/server/agent/bridge.ts"], {
    env: {
      ...process.env,
      LOOKUPS_URL: `http://127.0.0.1:${tool.port}/api/lookup`,
    },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
  });
  for (const line of lines) await bridge.stdin.write(`${line}\n`);
  await bridge.stdin.end();
  const replies = await new Response(bridge.stdout).text();
  return replies
    .trim()
    .split("\n")
    .map((reply) => JSON.parse(reply) as Reply);
};

const ask = async (message: object) => (await send([JSON.stringify(message)]))[0]!;

describe("the bridge between Codex and the tool", () => {
  it("answers a lookup with an error when the tool sends back an error page", async () => {
    const reply = await ask({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "trend", arguments: { ticker: "AAPL" } },
    });
    expect(reply.id).toBe(7);
    expect(reply.result?.isError).toBe(true);
    expect(reply.result?.content?.[0]?.text).toBe(
      "The tool could not answer the lookup trend (status 500).",
    );
  });

  it("lists no lookups when the tool sends back an error page", async () => {
    const reply = await ask({ jsonrpc: "2.0", id: 8, method: "tools/list" });
    expect(reply.id).toBe(8);
    expect(reply.result?.tools).toEqual([]);
  });

  it("answers a line it cannot read and keeps answering after it", async () => {
    const replies = await send([
      "null",
      "not json",
      "[]",
      JSON.stringify({ jsonrpc: "2.0", id: 9, method: "ping" }),
    ]);
    expect(replies.map((reply) => reply.error?.code ?? reply.id)).toEqual([
      -32600, -32700, -32600, 9,
    ]);
  });
});
