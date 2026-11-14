import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type Notification = {
  readonly method: string;
  readonly params: Readonly<Record<string, unknown>>;
};

type Message = {
  readonly id?: number | string;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
  readonly result?: unknown;
  readonly error?: { readonly message?: string };
};

const launcher = createRequire(import.meta.url).resolve("@openai/codex/bin/codex.js");

const tomlValue = (value: unknown): string => {
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(tomlValue).join(", ")}]`;
  if (typeof value === "object" && value !== null) {
    return `{ ${Object.entries(value)
      .map(([key, each]) => `${JSON.stringify(key)} = ${tomlValue(each)}`)
      .join(", ")} }`;
  }
  return String(value);
};

const bareKey = /^[A-Za-z0-9_-]+$/;

export const flagsFor = (settings: Readonly<Record<string, unknown>>, prefix = ""): string[] =>
  Object.entries(settings).flatMap(([key, value]) => {
    const path = `${prefix}${bareKey.test(key) ? key : JSON.stringify(key)}`;
    const table = typeof value === "object" && value !== null && !Array.isArray(value);
    if (table && prefix !== "mcp_servers.") {
      return flagsFor(value as Record<string, unknown>, `${path}.`);
    }
    return ["-c", `${path}=${tomlValue(value)}`];
  });

const stopped = "Codex stopped before it answered.";

class AppServer {
  readonly #child: ReturnType<typeof Bun.spawn<"pipe", "pipe", "ignore">>;
  readonly #waiting = new Map<
    number,
    { ok: (value: unknown) => void; fail: (cause: Error) => void }
  >();
  readonly #listeners = new Map<string, (notification: Notification) => void>();
  readonly #ready: Promise<unknown>;
  readonly #folder = mkdtempSync(join(tmpdir(), "fundamental-analysis-agent-"));
  #next = 0;
  #spare: Promise<string> | null = null;
  closed = false;

  constructor(flags: ReadonlyArray<string>) {
    this.#child = Bun.spawn([process.execPath, launcher, "app-server", ...flags], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "ignore",
    });
    void this.#read();
    void this.#child.exited.then(() => this.#close());
    this.#ready = this.#send("initialize", {
      clientInfo: {
        name: "fundamental-analysis",
        title: null,
        version: "1.0.0",
      },
      capabilities: null,
    }).then(() => this.#write({ method: "initialized" }));
  }

  async #read() {
    const decoder = new TextDecoder();
    let buffer = "";
    const reader = this.#child.stdout.getReader();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      buffer += decoder.decode(chunk.value, { stream: true });
      let end = buffer.indexOf("\n");
      while (end >= 0) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (line !== "") this.#receive(line);
        end = buffer.indexOf("\n");
      }
    }
  }

  #receive(line: string) {
    let message: Message;
    try {
      message = JSON.parse(line) as Message;
    } catch {
      return;
    }
    if (message.id !== undefined && message.method !== undefined) {
      this.#write({
        id: message.id,
        error: { code: -32601, message: "Not offered by this tool." },
      });
      return;
    }
    if (message.id !== undefined) {
      const waiting = this.#waiting.get(Number(message.id));
      this.#waiting.delete(Number(message.id));
      if (message.error !== undefined) waiting?.fail(new Error(message.error.message ?? stopped));
      else waiting?.ok(message.result);
      return;
    }
    if (message.method === undefined) return;
    const params = message.params ?? {};
    const thread = typeof params.threadId === "string" ? params.threadId : null;
    if (thread !== null) this.#listeners.get(thread)?.({ method: message.method, params });
  }

  #write(message: object) {
    if (this.closed) return;
    void this.#child.stdin.write(`${JSON.stringify(message)}\n`);
    void this.#child.stdin.flush();
  }

  #send(method: string, params: unknown) {
    if (this.closed) return Promise.reject(new Error(stopped));
    const id = ++this.#next;
    return new Promise<unknown>((ok, fail) => {
      this.#waiting.set(id, { ok, fail });
      this.#write({ id, method, params });
    });
  }

  #close() {
    if (this.closed) return;
    this.closed = true;
    for (const waiting of this.#waiting.values()) waiting.fail(new Error(stopped));
    this.#waiting.clear();
    for (const listener of this.#listeners.values()) {
      listener({
        method: "error",
        params: { error: { message: stopped }, willRetry: false },
      });
    }
    this.#listeners.clear();
  }

  async request(method: string, params: unknown) {
    await this.#ready;
    return this.#send(method, params);
  }

  #startThread() {
    return this.request("thread/start", {
      cwd: this.#folder,
      sandbox: "read-only",
      approvalPolicy: "never",
      ephemeral: true,
    }).then((result) => (result as { thread: { id: string } }).thread.id);
  }

  warm() {
    if (this.#spare !== null || this.closed) return;
    const spare = this.#startThread();
    this.#spare = spare;
    spare.catch(() => {
      if (this.#spare === spare) this.#spare = null;
    });
  }

  async thread() {
    const spare = this.#spare ?? this.#startThread();
    this.#spare = null;
    const id = await spare.catch(() => this.#startThread());
    this.warm();
    return id;
  }

  listen(thread: string, listener: (notification: Notification) => void) {
    this.#listeners.set(thread, listener);
    return () => this.#listeners.delete(thread);
  }

  stop() {
    this.#close();
    this.#child.kill();
  }
}

const shared = globalThis as typeof globalThis & {
  codexAppServer?: { readonly key: string; readonly server: AppServer };
};

export const appServer = (flags: ReadonlyArray<string>) => {
  const key = flags.join("\n");
  const running = shared.codexAppServer;
  if (running === undefined || running.key !== key || running.server.closed) {
    running?.server.stop();
    shared.codexAppServer = { key, server: new AppServer(flags) };
    process.once("exit", () => shared.codexAppServer?.server.stop());
  }
  return shared.codexAppServer!.server;
};
