# Learning Effect through this project

Each Effect idea, in the order the project first uses it, with a plain explanation and the file to read it in. The code itself carries no teaching comments.

## An Effect is a description of work

`Effect.gen(function* () { ... })` runs nothing. It describes steps, and `yield*` inside it means "do this step and give me its result". Nothing happens until a runtime is handed the description.

Read: [`src/server/migrations.ts`](../src/server/migrations.ts).

## Services

A service is a named piece of the program that other code asks for by name, with `yield* Settings` or `yield* SqlClient`. The code that asks does not know which file the database is, or whether the SEC it talks to is real or a stand-in.

`Context.Service<Self, Shape>()("Name")` declares one: the class is both the name and the description of what the service offers.

Read: [`src/server/settings.ts`](../src/server/settings.ts).

## Layers

A layer is a recipe for building services. Which database file is opened, or whether it is a throwaway one in memory for a test, is decided once, by whichever layer is provided when the program runs.

- `Layer.effect(Service, effect)` builds a service from an Effect, which may itself ask for other services.
- `Layer.provideMerge(other)` feeds one layer's services into another and keeps both available.
- `Layer.unwrap(effect)` builds a layer from an Effect, so work such as making a folder happens only when the layer is used.

Read: [`src/server/database.ts`](../src/server/database.ts).

## The schema tool

A schema describes the shape of a piece of data once. The same description checks rows coming back from the database and data arriving from the SEC, so anything in an unexpected shape fails loudly instead of flowing on.

`SqlSchema.findOneOption`, `findAll` and `void` tie a query to the schema of what it takes and what it returns.

Read: [`src/server/settings.ts`](../src/server/settings.ts), [`src/server/companies.ts`](../src/server/companies.ts).

## Running an Effect at the edge

`ManagedRuntime.make(layer)` builds the services once. `runtime.runPromise(effect)` runs a program with them and returns an ordinary promise, and a failure becomes a rejected promise. Server functions are the only place this happens, so screens never see Effect.

Read: [`src/server/runtime.ts`](../src/server/runtime.ts), [`src/functions/settings.ts`](../src/functions/settings.ts).

## Testing with Effect's helper for Vitest

`it.effect` runs a test written as an Effect. It comes with a test clock: `TestClock.adjust("5 minutes")` moves time forward at once, so waits and retries are tested without waiting.

Read: [`src/server/sec.test.ts`](../src/server/sec.test.ts).

## Errors as named kinds

`Data.TaggedError("Name")` makes an error with a tag. The type of every Effect lists which errors it can fail with, so a caller cannot forget one, and `Effect.catchTag("Name", ...)` handles one kind by name. Inside `Effect.gen`, `return yield* new SomeError()` fails with it.

Read: [`src/server/sec.ts`](../src/server/sec.ts).

## Retry schedules

A schedule says when to try again. `Schedule.exponential("500 millis")` waits half a second, then one, two and four seconds. `Schedule.jittered` adds randomness so retries do not bunch up. `Effect.retry({ schedule, times, while })` retries only the errors `while` accepts.

Read: [`src/server/sec.ts`](../src/server/sec.ts).

## Rate limiting with a semaphore

A semaphore lets a fixed number of fibers through at a time. With one permit, `Semaphore.withPermits(lock, 1)` makes requests take their turn one after another.

Read: [`src/server/sec.ts`](../src/server/sec.ts).

## Transactions

`sql.withTransaction(effect)` runs every query inside it as one transaction: all of it is stored, or none of it.

Read: [`src/server/companies.ts`](../src/server/companies.ts).

## Decoding outside data one piece at a time

`Schema.decodeUnknownEffect(schema)(data)` checks data from outside and fails the whole Effect if anything is off. When one bad entry should not sink the rest, `Schema.decodeUnknownResult(schema)` checks a single entry and returns a `Result`: `Result.isFailure(result)` says whether it failed, `result.failure.message` says why, and `result.success` holds the checked value.

Read: [`src/server/collect.ts`](../src/server/collect.ts).

## The command line module

`Command.make("collect", { ticker: Argument.String("ticker") }, handler)` declares a command, its arguments and the Effect it runs. `Command.run(command, { version })` reads the arguments, prints help and errors, and runs the handler. `BunRuntime.runMain` runs the whole program on Bun and turns a failure into an exit code, and `BunServices.layer` supplies the files, terminal and standard input the command module needs.

Read: [`src/cli/collect.ts`](../src/cli/collect.ts).
