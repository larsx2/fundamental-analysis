---
status: accepted
date: 2026-11-11
---

# Use Effect's own database client to talk to SQLite

All reading and writing of the SQLite database goes through Effect's own database client, with the SQL written directly and the shape of each result described with Effect's schema tool. We chose it because learning Effect is a goal of this project, because the data collecting already runs inside Effect and can then share one connection and one transaction with the database work, and because the official bridge from Effect to Kysely was not carried over to Effect version 4.

The client is labelled unstable in Effect version 4, which means its interface may change in a later release. We accept that by fixing the exact version in the project and upgrading on purpose.

## Considered options

- **Kysely alone, wrapped by hand for Effect.** A settled interface that checks queries while the code is written, but it needs a hand-written wrapper and keeps database work outside Effect's own transactions.
- **Kysely on top of Effect's client through a community bridge.** Still possible later without changing the connection, if checking queries while writing them turns out to matter.

Explored in [Which technology to build the first version on](../rfc/0003-technology-stack.md).
