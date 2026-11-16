import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Data,
  Deferred,
  Effect,
  Fiber,
  Option,
  Queue,
  Schema,
  Scope,
  Stream,
  SynchronizedRef,
} from "effect";
import * as ChildProcess from "effect/process/ChildProcess";

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

export class CodexStopped extends Data.TaggedError("CodexStopped")<{
  readonly cause?: unknown;
}> {
  override get message() {
    return "Codex stopped before it answered.";
  }
}

export class CodexRefused extends Data.TaggedError("CodexRefused")<{
  readonly method: string;
  readonly reason: string;
}> {
  override get message() {
    return this.reason;
  }
}

export class CodexUnexpected extends Data.TaggedError("CodexUnexpected")<{
  readonly method: string;
  readonly cause: unknown;
}> {
  override get message() {
    return `Codex replied to ${this.method} in a shape the tool cannot read.`;
  }
}

export type CodexError = CodexStopped | CodexRefused | CodexUnexpected;

export type Connection = {
  readonly request: (method: string, params: unknown) => Effect.Effect<unknown, CodexError>;
  // A thread started ahead of time is handed out first, and another is
  // started in its place, so a question does not wait for one.
  readonly thread: Effect.Effect<string, CodexError>;
  readonly warm: Effect.Effect<void>;
  // Gives the next notification for a thread. Notifications are kept from the
  // moment `listen` runs, so none is missed while a turn starts.
  readonly listen: (
    thread: string,
  ) => Effect.Effect<
    { readonly next: Effect.Effect<Notification, CodexStopped> },
    never,
    Scope.Scope
  >;
  readonly isOpen: Effect.Effect<boolean>;
};

const launcher = createRequire(import.meta.url).resolve("@openai/codex/bin/codex.js");

export const codexProgram: ReadonlyArray<string> = [process.execPath, launcher, "app-server"];

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

const parse = (line: string): Message | null => {
  try {
    const message: unknown = JSON.parse(line);
    return typeof message === "object" && message !== null ? (message as Message) : null;
  } catch {
    return null;
  }
};

const ThreadStarted = Schema.Struct({
  thread: Schema.Struct({ id: Schema.String }),
});

// Starts Codex's app server and talks to it in JSON-RPC, one message per line.
// Codex is stopped when the scope closes, or when this process exits.
export const connect = (flags: ReadonlyArray<string>, program = codexProgram) =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope;
    const folder = yield* Effect.acquireRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "fundamental-analysis-agent-"))),
      (folder) => Effect.sync(() => rmSync(folder, { recursive: true, force: true })),
    );

    const outgoing = yield* Queue.unbounded<string>();
    const [command = process.execPath, ...args] = program;
    const child = yield* ChildProcess.make(command, [...args, ...flags], {
      stdin: Stream.fromQueue(outgoing).pipe(Stream.encodeText),
      stderr: "ignore",
      // Kept in this process's group, so stopping the tool from the terminal
      // stops Codex with it.
      detached: false,
    }).pipe(Effect.mapError((cause) => new CodexStopped({ cause })));

    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const stop = () => {
          try {
            process.kill(child.pid);
          } catch {
            // Codex has already stopped.
          }
        };
        process.once("exit", stop);
        return stop;
      }),
      (stop) => Effect.sync(() => process.off("exit", stop)),
    );

    const waiting = new Map<
      number,
      {
        readonly method: string;
        readonly reply: Deferred.Deferred<unknown, CodexError>;
      }
    >();
    let next = 0;
    const closed = yield* Deferred.make<void>();
    // Each thread's notifications go to the turn listening to it, and then the
    // reason Codex stopped.
    const listeners = new Map<string, Queue.Queue<Notification, CodexStopped>>();

    const write = (message: object) => Queue.offer(outgoing, `${JSON.stringify(message)}\n`);

    const close = (stopped: CodexStopped) =>
      Effect.gen(function* () {
        if (!(yield* Deferred.succeed(closed, undefined))) return;
        for (const { reply } of waiting.values()) yield* Deferred.fail(reply, stopped);
        waiting.clear();
        for (const queue of listeners.values()) yield* Queue.fail(queue, stopped);
      });

    const receive = (line: string) =>
      Effect.gen(function* () {
        const message = parse(line);
        if (message === null) {
          return yield* Effect.logWarning("Codex sent a line that is not JSON", line.slice(0, 200));
        }
        if (message.id !== undefined && message.method !== undefined) {
          yield* Effect.logWarning(
            `Codex asked for ${message.method}, which the tool does not offer`,
          );
          return yield* write({
            id: message.id,
            error: { code: -32601, message: "Not offered by this tool." },
          });
        }
        if (message.id !== undefined) {
          const id = Number(message.id);
          const sent = waiting.get(id);
          waiting.delete(id);
          if (sent === undefined) return;
          if (message.error !== undefined) {
            const reason = message.error.message ?? "Codex refused the request.";
            return yield* Deferred.fail(
              sent.reply,
              new CodexRefused({ method: sent.method, reason }),
            );
          }
          return yield* Deferred.succeed(sent.reply, message.result);
        }
        if (message.method === undefined) return;
        const params = message.params ?? {};
        const listener = listeners.get(String(params.threadId));
        if (listener !== undefined)
          yield* Queue.offer(listener, { method: message.method, params });
      });

    // When Codex's output ends, Codex has stopped: every request still waiting,
    // and every turn still listening, fails with the reason.
    yield* child.stdout.pipe(
      Stream.decodeText(),
      Stream.splitLines,
      Stream.map((line) => line.trim()),
      Stream.filter((line) => line !== ""),
      Stream.runForEach(receive),
      Effect.exit,
      Effect.flatMap((exit) =>
        Effect.gen(function* () {
          if (yield* Deferred.isDone(closed)) return;
          const exitCode = yield* child.exitCode.pipe(
            Effect.timeoutOption("1 second"),
            Effect.option,
          );
          const stopped = new CodexStopped({ cause: { output: exit, exitCode } });
          yield* Effect.logWarning("Codex stopped", stopped.cause);
          yield* close(stopped);
        }),
      ),
      Effect.forkIn(scope),
    );
    yield* Effect.addFinalizer(() => close(new CodexStopped({ cause: "The tool closed it." })));

    const request = (method: string, params: unknown): Effect.Effect<unknown, CodexError> =>
      Effect.suspend(() => {
        if (Deferred.isDoneUnsafe(closed)) return Effect.fail(new CodexStopped({}));
        const id = ++next;
        const reply = Deferred.makeUnsafe<unknown, CodexError>();
        waiting.set(id, { method, reply });
        return write({ id, method, params }).pipe(
          Effect.andThen(Deferred.await(reply)),
          Effect.onInterrupt(() => Effect.sync(() => waiting.delete(id))),
        );
      });

    yield* request("initialize", {
      clientInfo: {
        name: "fundamental-analysis",
        title: null,
        version: "1.0.0",
      },
      capabilities: null,
    }).pipe(
      // Without a limit, a Codex that never starts would hold every question.
      Effect.timeoutOrElse({
        duration: "30 seconds",
        orElse: () =>
          Effect.fail(new CodexStopped({ cause: "Codex did not start within 30 seconds." })),
      }),
    );
    yield* write({ method: "initialized" });

    const startThread = request("thread/start", {
      cwd: folder,
      sandbox: "read-only",
      approvalPolicy: "never",
      ephemeral: true,
    }).pipe(
      Effect.flatMap((reply) =>
        Schema.decodeUnknownEffect(ThreadStarted)(reply).pipe(
          Effect.mapError((cause) => new CodexUnexpected({ method: "thread/start", cause })),
        ),
      ),
      Effect.map((started) => started.thread.id),
    );

    const spare = yield* SynchronizedRef.make(Option.none<Fiber.Fiber<string, CodexError>>());

    const warm = SynchronizedRef.updateEffect(spare, (current) =>
      Effect.gen(function* () {
        if (Option.isSome(current) || (yield* Deferred.isDone(closed))) return current;
        const fiber = yield* startThread.pipe(
          Effect.tapError((error) =>
            Effect.logWarning("A spare thread could not be started", error),
          ),
          Effect.forkIn(scope),
        );
        return Option.some(fiber);
      }),
    );

    const thread = Effect.gen(function* () {
      const taken = yield* SynchronizedRef.getAndSet(spare, Option.none());
      const id = yield* Option.match(taken, {
        onNone: () => startThread,
        onSome: (fiber) => Fiber.join(fiber).pipe(Effect.catch(() => startThread)),
      });
      yield* warm;
      return id;
    });

    const listen = (thread: string) =>
      Effect.acquireRelease(
        Effect.gen(function* () {
          const queue = yield* Queue.unbounded<Notification, CodexStopped>();
          listeners.set(thread, queue);
          if (yield* Deferred.isDone(closed)) yield* Queue.fail(queue, new CodexStopped({}));
          return queue;
        }),
        (queue) =>
          Effect.sync(() => {
            if (listeners.get(thread) === queue) listeners.delete(thread);
          }),
      ).pipe(Effect.map((queue) => ({ next: Queue.take(queue) })));

    return {
      request,
      thread,
      warm,
      listen,
      isOpen: Effect.map(Deferred.isDone(closed), (done) => !done),
    } satisfies Connection;
  });
