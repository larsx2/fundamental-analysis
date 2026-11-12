# Fundamental Analysis

A local tool for understanding how a public company works by looking at its numbers, its decisions and the world around it, all on one timeline.

## Why it exists

To make it possible to understand 100 US-listed public companies in a short time, starting with no background in fundamental analysis.

It is not a course. It teaches through how it is built: clear visuals, numbers you can move and compare, and the same plain words everywhere. Using it should be enough to learn how a company's finances fit together.

## What it covers

- US-listed public companies that file an annual report (10-K). Banks, insurers and property trusts are not covered yet.
- Any such company, collected when you ask for it. There is no fixed list.
- What each company reported in its filings, year by year.
- Where each dollar of revenue goes.
- What the company did with its money, and the notable things that happened to it.
- What the economy was doing at the time. What the industry and share prices in general were doing comes later.

## Where it runs

Entirely on your own machine. There is no account and no service to sign up for. The internet is used only to collect a company's filings from the SEC and the economic figures that go with them. Everything already collected works offline.

## What it is not

- It gives no advice on what to buy or sell.
- It does not forecast.
- It is not a replacement for reading the filings. It is a faster way into them.

## Status

Nothing is built yet. The project is at the stage of naming things and working out what to build.

The plan is to publish it as open source under the MIT licence. Until a licence file is added, no licence has been granted.

## Rules that follow from being open source

- Everything the tool is built on must have a licence that allows it to be shared under MIT. One file is the exception: the photo behind the home screen is under the Unsplash licence, as [its note](src/assets/LICENCES.md) says.
- The repository holds code and documents only. It never holds collected filing data, share prices, index values, company logos, or screens from other products. Each person collects their own data when they run the tool, and the tool fetches each collected company's logo from Wikidata onto that computer.
- No secrets, personal settings or references to private work are committed.
- Nothing here is investment advice.

## Where things are

| File or folder                   | What it holds                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`GLOSSARY.md`](./GLOSSARY.md)   | The official words of the project, in the order to learn them. The tool uses these words and no others. |
| [`field-map.md`](./field-map.md) | A short map of the field: what it is called, what it includes, and where the data comes from.           |
| [`todo.md`](./todo.md)           | The work to reach the first version, in order, with a check for every task.                             |
| [`docs/rfc/`](./docs/rfc/)       | Open questions and ideas being explored. Start with its README.                                         |
| [`docs/adr/`](./docs/adr/)       | Decisions that were made, and why. Each one is a short file.                                            |

## Tasks

Commands are run through [Task](https://taskfile.dev).

| Command       | What it does                                                  | Works today |
| ------------- | ------------------------------------------------------------- | ----------- |
| `task`        | Lists every task                                              | Yes         |
| `task doctor` | Checks the tools the project needs, without changing anything | Yes         |
| `task init`   | Installs what the project depends on                          | Not yet     |
| `task dev`    | Starts the tool locally                                       | Not yet     |
| `task check`  | Looks for problems without changing any file                  | Not yet     |
| `task fix`    | Applies the automatic fixes                                   | Not yet     |
| `task test`   | Runs the tests                                                | Not yet     |
| `task build`  | Builds the tool                                               | Not yet     |
| `task ci`     | Runs everything that must pass before work is handed over     | Not yet     |

The rules behind these names are written at the top of [`Taskfile.yml`](./Taskfile.yml).

## How ideas become decisions

1. A question or an idea is written down as an RFC in `docs/rfc/`.
2. It is explored through research, a quick prototype, or discussion.
3. What was learned is written back into the RFC as its outcome.
4. If the outcome is a decision that would be hard to change later, it is also recorded as a short ADR in `docs/adr/`.
