---
status: accepted
date: 2026-11-11
---

# Build on TypeScript, Effect, SQLite and TanStack Start, run on Bun

The tool is written in TypeScript and runs on Bun. Effect handles everything behind the screens, SQLite is the database, and TanStack Start with React serves the screens, built with Vite+. Charts are drawn as SVG with D3 doing the calculations. Tailwind, Base UI and Motion give the look and feel, and TanStack Query keeps fetched data between screens.

We chose this because the tool runs entirely on the person's own machine, with a small amount of data and no service to host, because collecting from the SEC is the hardest part and is what Effect is best at, because learning Effect is a goal of the project, and because the two central screens are custom drawings that a ready-made chart library would get in the way of. Every piece has a licence that allows the project to be shared under MIT.

## Consequences

- Effect stays out of screen code. Screens are plain React that call a function and get data back.
- Bun was chosen over Node by preference. One early report describes Vite+ failing to start a TanStack Start project installed with Bun, so the first task of the build must prove the pieces start together. If Vite+ is the piece that fails, plain Vite replaces it, with Oxlint and Oxfmt added by themselves for checking and tidying the code.
- Several Effect modules in use are labelled unstable, so exact versions are fixed and upgrades are done on purpose.

## What the first task proved, on 11 November 2026

Vite+ 1.6.0 starts TanStack Start 1.169.5 on Bun 1.4.0, so no fallback was needed. Two things are required for it to work:

- Every package that asks for Vite gets Vite+'s own copy, set under `overrides` in `package.json`, and Vitest is fixed to the version Vite+ bundles. Without this, a second copy of Vite was installed and every page answered "Cannot GET /", the problem described in the early bug report.
- Each command starts with `bun --bun`. Vite+'s command is written for Node, and without that flag it runs on Node even when started from Bun. With it, the server, the build and the tests all run on Bun.

Formatting, lint rules and type checks all run through `vp check`, which also formats the Markdown documents. The server listens on port 4100, on this machine only.

## What the next two tasks proved, on 11 November 2026

- Effect 4.1.4 reads and writes SQLite through `@effect/sql-sqlite-bun`, and changes to the database's structure run through its migrator. Tests run on Bun through `@effect/vitest`, against a database in memory.
- Effect's checking plugin works. For TypeScript 7 it is `@effect/tsgo`, not `@effect/language-service`, and it supports exactly the TypeScript, Oxlint and type checker versions Vite+ 1.6.0 bundles. `task check` runs through its `effect-tsgo` command, which loads Effect's rules into Oxlint without changing anything installed. The recommended set of rules is on, except the warning about modules labelled unstable, since exact versions are fixed instead.
- A server function runs an Effect program through one shared runtime and returns plain data. Screens fetch it through TanStack Query and contain no Effect code, and none of the database code reaches the browser.
- On macOS, Bun uses the SQLite that comes with the system, version 3.43.2, which includes FTS5 text search.

Explored in [Which technology to build the first version on](../rfc/0003-technology-stack.md). The database client is covered separately in [Use Effect's own database client to talk to SQLite](./0001-effect-database-client-for-sqlite.md).
