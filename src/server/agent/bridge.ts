const endpoint = process.env.LOOKUPS_URL ?? "http://127.0.0.1:4100/api/lookup";

type Message = {
  readonly id?: number | string;
  readonly method?: string;
  readonly params?: {
    readonly protocolVersion?: string;
    readonly name?: string;
    readonly arguments?: unknown;
  };
};

const send = (message: object) => process.stdout.write(`${JSON.stringify(message)}\n`);

const unreachable =
  "The tool is not running, so its figures cannot be read. Start it with `task dev` and ask again.";

const failure = (text: string) => ({
  content: [{ type: "text", text }],
  isError: true,
});

const callLookup = async (name: string, input: unknown) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, input }),
  }).catch(() => null);
  if (response === null) return failure(unreachable);
  const body = (await response.json().catch(() => null)) as
    | { result: { figures: unknown; notes: unknown; lookup: string } }
    | { error: string }
    | null;
  if (body === null) {
    return failure(`The tool could not answer the lookup ${name} (status ${response.status}).`);
  }
  if ("error" in body) return failure(body.error);
  const { lookup, figures, notes } = body.result;
  return {
    content: [{ type: "text", text: JSON.stringify({ lookup, figures, notes }) }],
    structuredContent: body.result,
  };
};

const handle = async (message: Message) => {
  if (message.id === undefined) return;
  const reply = (result: object) => send({ jsonrpc: "2.0", id: message.id, result });
  switch (message.method) {
    case "initialize":
      return reply({
        protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "fundamental-analysis", version: "1.0.0" },
      });
    case "ping":
      return reply({});
    case "tools/list": {
      const response = await fetch(endpoint).catch(() => null);
      const tools: unknown = await response?.json().catch(() => null);
      return reply({ tools: Array.isArray(tools) ? tools : [] });
    }
    case "tools/call":
      return reply(await callLookup(message.params?.name ?? "", message.params?.arguments ?? {}));
    default:
      return send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: `Unknown method ${message.method}` },
      });
  }
};

for await (const line of console) {
  if (line.trim() === "") continue;
  let message: Message;
  try {
    message = JSON.parse(line) as Message;
  } catch (cause) {
    process.stderr.write(`${String(cause)}\n`);
    continue;
  }
  await handle(message).catch((cause: unknown) => {
    process.stderr.write(`${String(cause)}\n`);
    if (message.id === undefined) return;
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32603, message: String(cause) },
    });
  });
}

export {};
