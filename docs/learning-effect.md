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

## Queues, work in the background, and scopes

`Queue.unbounded<number>()` makes a line that any part of the program can add to with `Queue.offer` and take from with `Queue.take`, which waits until something is there. `Effect.forever(Queue.take(line).pipe(Effect.flatMap(collectOne)))` takes companies one at a time, for as long as the program runs.

`Effect.forkScoped(effect)` starts that loop in the background, tied to a scope. When the scope closes, because the server stops or a test ends, the loop is stopped with it, so nothing is left running.

`Effect.catchCause` catches every way an Effect can fail, including a crash, so one failed company is marked failed and the line carries on.

Read: [`src/server/collector.ts`](../src/server/collector.ts).

## Running several Effects together

`Effect.all([a, b, c])` runs a list of Effects and gives back their results in the same order. If one fails, the whole thing fails with that error. The three statements are read this way: the yearly amounts, the balances at year ends and the amounts per share.

Read: [`src/server/terms/terms.ts`](../src/server/terms/terms.ts).

## Giving one Effect a service directly

`Effect.provideService(Sec, sec)` hands a single Effect the service it asks for, without building a layer. Collecting a company's filings is written as a plain Effect that asks for `Sec` and `SqlClient`; the `Collect` service already holds both, so it passes them in.

Read: [`src/server/collect.ts`](../src/server/collect.ts).

## Giving up after a while, and falling back

`Effect.timeout("20 seconds")` fails an Effect that takes longer than that. `Effect.catchCause(() => Effect.succeed(false))` turns any failure into an ordinary answer, so the economic data keeps the months it already holds when the central bank's service cannot be reached. `Effect.ignore` does the same when nothing needs to be known about the failure, as when a company's business description cannot be read.

Read: [`src/server/economy.ts`](../src/server/economy.ts), [`src/server/collect.ts`](../src/server/collect.ts).

## Checking what a screen sends to the server

A server function's `.validator(Schema.decodeUnknownSync(schema))` checks the data a screen sends before the function runs, with the same schema tool used for the SEC's data. A wrong shape throws there, so the Effect inside never sees it.

Read: [`src/functions/companies.ts`](../src/functions/companies.ts).
