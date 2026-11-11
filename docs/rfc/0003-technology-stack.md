---
status: exploring
opened: 2026-11-11
closed:
---

# Which technology to build the first version on

## Question

Is TypeScript with Effect, Kysely, SQLite, Vite+ and TanStack Start the right base for a tool that runs locally for one person, and what is missing from that list?

## Why it matters

These choices are the hardest to change once screens and data are built on them. The tool has two very different halves, collecting filing data and drawing it, and a stack that suits one half can get in the way of the other.

## What we know

**The tool's shape**

- It runs on one machine for one person. There are no accounts and nothing to deploy.
- It reads far more than it writes. Data is collected in batches, then explored many times.
- The data is small: 100 public companies, ten or more fiscal years, a few hundred reported numbers per filing.
- The SEC allows at most ten requests per second to its data service, and filing data is inconsistent between companies. Collecting it reliably is the hardest engineering in the project.
- Two of the four company screens, the timeline and where the money goes, are custom drawings that no ready-made chart covers.

**Licences**

The project is planned as open source under the MIT licence, so everything it is built on must allow that. Every piece recommended below does: Effect, TanStack Start, Vite+ and React are MIT, D3 is ISC, TypeScript is Apache 2.0, and SQLite is in the public domain. Any piece added later needs the same check before it is adopted.

**The state of each piece, checked on 11 November 2026**

- Vite+ reached a stable 1.0 in autumn 2026 and is open source under the MIT licence. It bundles Vite, Vitest, Oxlint, Oxfmt, Rolldown and tsdown behind one command. Sources: [InfoQ on the 1.0 release](https://infoq.com/news/2026/10/cloudflare-viteplus-stable), [VoidZero on the alpha and the MIT licence](https://voidzero.dev/posts/announcing-vite-plus-alpha).
- TanStack Start reached a stable 1.0 on 13 October 2026. Source: [Netlify changelog](https://www.netlify.com/changelog/2026-10-13-tanstack-start-1-0/).
- Effect version 4 is released. It reached release candidate on 12 August 2026, and its packages now carry version numbers such as 4.0.6. Sources: [Effect's August recap](https://effect.website/blog/effect-v4-rc-august-recap/), [an Effect 4.0.6 release](https://github.com/Effect-TS/effect/releases/tag/%40effect/sql-mssql%404.0.6).
- Effect has its own database client. In version 4 it lives inside the main package under a name that includes the word "unstable", which means its interface may still change between releases. The SQLite connector for Node is [`@effect/sql-sqlite-node`](https://www.npmjs.com/package/@effect/sql-sqlite-node), at version 4.0.5, built on the SQLite that ships inside Node.
- The official bridge between Effect and Kysely, `@effect/sql-kysely`, covers Effect version 3 only. For version 4 there are only community bridges, such as [effect-kysely](https://github.com/SugiyamaLabs/effect-kysely), which builds a query with Kysely and runs it through Effect's client.
- Not confirmed: the minimum Node version the SQLite connector needs. One source says 22.16 and another 22.13.

## Options

### Settled on 11 November 2026: the stack is accepted, run on Bun

The whole recommended stack below is accepted, including the pieces under "What the stack is still missing", with one change: it runs on Bun, not Node. It is recorded in [Build on TypeScript, Effect, SQLite and TanStack Start, run on Bun](../adr/0004-stack-run-on-bun.md).

What is known about Bun with these pieces:

- Bun 1.4.0 is already installed on the machine the project is being built on.
- Bun publishes its own guide for running TanStack Start ([Bun's guide](https://bun.com/docs/guides/ecosystem/tanstack-start)).
- Bun runs Vite with no extra setup ([Bun's guide](https://bun.com/docs/guides/ecosystem/vite)).
- Effect has a SQLite connector made for Bun, `@effect/sql-sqlite-bun`, which uses the SQLite built into Bun.
- One risk: an early bug report describes Vite+ failing to start a TanStack Start project that was installed with Bun ([issue 1391](https://github.com/voidzero-dev/vite-plus/issues/1391)). It was against a much older Vite+ and may be fixed. The first task of the build must prove that all the pieces start together on Bun. If Vite+ is the piece that fails, plain Vite replaces it.
- Oxc, the fast toolkit for reading, checking and tidying code, needs no separate decision. Vite+ already includes its checker, Oxlint, and its tidier, Oxfmt, and builds with a bundler made on Oxc. If Vite+ has to be replaced by plain Vite, Oxlint and Oxfmt are added by themselves so `task check` and `task fix` stay the same. ESLint and Prettier are not used.
- Oxlint knows nothing about Effect. Mistakes that are specific to Effect, such as writing an Effect and never running it, are caught by Effect's own checking plugin for TypeScript, which should be added alongside. Confirmed on 11 November 2026: for TypeScript 7 the plugin is `@effect/tsgo`, and it runs inside `task check`.

### Recommended: the proposed stack, with two limits and two additions

| Piece          | Verdict                                         | Reason                                                                                                                                             |
| -------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript     | Keep                                            | One language for collecting, storing and drawing.                                                                                                  |
| SQLite         | Keep                                            | A single local file fits a single local user, and the data is small.                                                                               |
| Kysely         | Drop, in favour of Effect's own database client | Its official bridge to Effect stops at version 3, and the data collecting already runs inside Effect.                                              |
| Effect         | Keep, for everything behind the screens         | Learning Effect is a goal of this project. Rate limits, retries, checking messy data and resuming a half-finished run are also what it is best at. |
| TanStack Start | Keep                                            | Screens can read the database directly with no separate service in between, and the chosen company, fiscal year and range live in the address bar. |
| Vite+          | Keep                                            | It is stable now, and it sits on plain Vite, so stepping back to plain Vite is cheap.                                                              |

**Limit one: Effect stays out of the screens.** Settled on 11 November 2026: learning Effect is a goal of this project, alongside learning fundamental analysis. So Effect covers everything behind the screens: collecting the data, the database, and the functions the screens call. Screen code stays plain React that calls a function and gets data back. This keeps the drawing code simple and gives Effect a clear territory to be learned in.

A good order to learn it in follows the order the tool is built in: first fetching one filing with retries and the SEC rate limit, then checking its shape with Effect's schema tool, then storing it through Effect's database client, then collecting 100 companies at once.

**Limit two: one database layer, not two.** Effect has its own database client, and using it alongside Kysely gives two ways to do the same thing. The usual Effect approach is to write the SQL directly through that client and describe the shape of each result with Effect's schema tool, which checks the rows as they come back. That is the one to keep. It shares one connection and one transaction with the data collecting, which already runs inside Effect.

What is given up: Kysely checks a query against the table definitions while the code is being written. Effect's client checks the rows when the query runs. If that turns out to matter, a community bridge can add Kysely's query builder on top of Effect's client later without changing the connection.

Settled on 11 November 2026: Effect's own database client is the choice. It is recorded in [Use Effect's own database client to talk to SQLite](../adr/0001-effect-database-client-for-sqlite.md).

An earlier draft of this RFC recommended Kysely alone. That changed on 11 November 2026 after checking that the official Kysely bridge was not carried over to Effect version 4.

**Addition one: a drawing layer.** This is the most important choice for this product and it is not in the list. The recommendation is D3 for the calculations, such as scales, line shapes and flow layouts, with React drawing the result as SVG. A ready-made chart library would be faster for simple line charts and would then block the timeline and the money flow view.

**Addition two: React for the screens.** TanStack Start works with React or Solid. React has the larger set of examples for custom SVG work.

### What the stack is still missing

Looked at as a whole, with custom charts and an agent in mind, the list so far covers collecting, storing and serving. It leaves gaps in five places. They are ordered by how much the first version depends on them. Licences are from memory and each needs confirming before the piece is adopted.

**1. The layer that turns filing data into glossary terms. Our own code, and the real core.**
Companies label the same thing differently in their filings. Revenue alone appears under several official tags. Nothing off the shelf maps those tags onto the 76 glossary terms, and every screen depends on that mapping being right. It deserves its own RFC before any screen is built. No library is missing here. What is missing is the design.

**2. A look-and-feel layer. D3 draws charts, not the controls and layout around them.**

| Need                                                                                             | Suggested piece                                               | Licence           |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------- |
| Colours, spacing and type sizes defined once and reused everywhere                               | Tailwind CSS version 4, with the values held as CSS variables | MIT               |
| Tabs, switches, pop-up cards, tooltips and dialogs that work with a keyboard and a screen reader | Base UI                                                       | MIT               |
| Search that opens from any screen with one key                                                   | cmdk                                                          | MIT               |
| Movement: panels sliding, lines drawing, values changing smoothly                                | Motion                                                        | MIT               |
| Numbers that roll from one value to the next when the fiscal year changes                        | NumberFlow                                                    | MIT               |
| A typeface whose digits all have the same width, so columns of numbers line up                   | Inter or Geist                                                | Open Font License |
| Icons                                                                                            | Lucide                                                        | ISC               |

**3. A cache between the screens and the functions they call.**
TanStack Query (MIT). Moving through ten fiscal years on the money flow view asks for the same data again and again. This keeps what was already fetched, fetches the neighbouring years ahead of time, and is made to work with TanStack Start.

**4. The agent's two halves.**

- Talking to a language model: Effect's own module for it, which fits the goal of learning Effect and lets the model be swapped. It carries the same unstable label as the database client.
- Finding the right passage of a filing to answer from: the text search built into SQLite, called FTS5, so no extra service is needed. Confirmed on 11 November 2026: on macOS, Bun uses the system SQLite, version 3.43.2, and it includes FTS5. Bun on Linux ships its own SQLite, which has not been checked yet.

**5. Proof that the screens look right.**

- Playwright (Apache 2.0) to open each screen and compare it against a saved picture, so a change to one chart cannot quietly break another.
- Effect's helper for Vitest, to test the collecting code.

**Deliberately not added**

| Tempting piece                                                  | Why it is not needed                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A ready-made chart library                                      | The timeline and money flow view are custom. D3's own parts for flows and for zooming cover them. |
| A table library                                                 | The statements are about sixty lines by ten fiscal years. A plain table handles that.             |
| Drawing on canvas or with the graphics card                     | A few hundred points per chart is far below where SVG slows down.                                 |
| A separate tool for holding screen state                        | The address bar holds the company, fiscal year and range. The cache holds the data.               |
| A date or number library                                        | Effect has both, and the browser formats numbers by itself.                                       |
| A separate tool for changing the database's structure over time | Effect's database client includes one.                                                            |

### What unstable means, and the stable alternative

The label is about the interface, not about reliability. It means the names and shapes of the functions may change in a later release, so an upgrade can require edits. It does not mean the client loses data or fails at random.

The label is also not special to the database client. In Effect version 4 the same label sits on its modules for web requests, command line tools and several others ([InfoQ on the beta](https://infoq.com/news/2026/04/effect-v4-beta/)). Building almost anything real with Effect 4 means using modules that carry it.

There are two ways to live with that:

1. **Use Effect's client and fix the version.** Write the exact version number in the project so nothing changes until an upgrade is chosen. For a local tool with one user, an interface change then costs some edits on a day of our choosing. This is the recommended way here, because learning Effect is a goal.
2. **Use a stable database library and wrap it.** Kysely, or the SQLite that ships inside Node, has a settled interface. Each call is wrapped by hand so that Effect can run it, retry it and report its errors. This is the standard way to use any library that was not written for Effect. It is stable, at the price of writing and keeping that wrapper, and of the database work sitting outside Effect's own transactions.

### Simpler alternative: leave Effect out

Use plain TypeScript with a small queue for the SEC rate limit and a checking library for incoming data. This is quicker to start and enough for 100 companies. It gives up Effect's built-in handling of retries, resuming and errors, which would then be written by hand as the collecting grows. Ruled out on 11 November 2026, because learning Effect is a goal of the project.

### Lighter alternative: no TanStack Start

A plain Vite app with a small local server. This removes one framework but means writing the link between screens and database by hand, and losing typed address bar state.

## Open points

- How does the agent connect to a language model subscription? This needs its own RFC.
- Does the drawing layer deserve its own RFC with a quick prototype of the timeline?
- The mapping from filing tags to glossary terms has its own RFC: [How filing data becomes glossary terms](./0004-filing-data-to-glossary-terms.md).
- The SEC asks every program that reads its data to identify itself with contact details, and refuses requests that do not. Each person running the tool must supply their own, and the project cannot ship one. Where is it asked for and stored?
- New filings arrive every quarter, and companies sometimes file a corrected version of an old one. How is the collected data brought up to date?
- Confirm the licence of every piece in "What the stack is still missing". Whether the SQLite inside Bun includes its text search was answered on 11 November 2026: it does on macOS, and Linux is unchecked.

## Outcome
