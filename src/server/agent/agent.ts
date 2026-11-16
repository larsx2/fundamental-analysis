import { Context, Effect, Exit, Layer, Scope, SynchronizedRef } from "effect";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import { type CodexError, codexProgram, type Connection, connect } from "./codex-app-server";

type Running = {
  readonly key: string;
  readonly scope: Scope.Closeable;
  readonly connection: Connection;
};

// Keeps one Codex running between questions. Codex is started again when the
// settings it needs change, or after it stops, and stopped with the runtime.
export class Agent extends Context.Service<
  Agent,
  {
    readonly connection: (flags: ReadonlyArray<string>) => Effect.Effect<Connection, CodexError>;
  }
>()("Agent") {
  static readonly layerWith = (program: ReadonlyArray<string>) =>
    Layer.effect(
      Agent,
      Effect.gen(function* () {
        const spawner = yield* ChildProcessSpawner;
        const running = yield* SynchronizedRef.make<Running | null>(null);

        const stop = (current: Running | null) =>
          current === null ? Effect.void : Scope.close(current.scope, Exit.void);

        yield* Effect.addFinalizer(() => SynchronizedRef.get(running).pipe(Effect.flatMap(stop)));

        const start = (key: string, flags: ReadonlyArray<string>) =>
          Effect.gen(function* () {
            const scope = yield* Scope.make();
            const connection = yield* connect(flags, program).pipe(
              Scope.provide(scope),
              Effect.provideService(ChildProcessSpawner, spawner),
              Effect.onError((cause) => Scope.close(scope, Exit.failCause(cause))),
            );
            return { key, scope, connection } satisfies Running;
          });

        const connection = (flags: ReadonlyArray<string>) =>
          SynchronizedRef.modifyEffect(running, (current) =>
            Effect.gen(function* () {
              const key = flags.join("\n");
              if (current !== null && current.key === key && (yield* current.connection.isOpen)) {
                return [current.connection, current] as const;
              }
              yield* stop(current);
              const started = yield* start(key, flags).pipe(
                Effect.tapError((error) => Effect.logWarning("Codex could not be started", error)),
              );
              return [started.connection, started] as const;
            }),
          );

        return Agent.of({ connection });
      }),
    );

  static readonly layer = Agent.layerWith(codexProgram);
}
