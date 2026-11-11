# Fundamental Analysis

A local tool for understanding how a public company works by looking at its numbers, its decisions and the world around it, all on one timeline.
## Why it exists

To make it possible to understand 100 US-listed public companies in a short time, starting with no background in fundamental analysis.

It is not a course. It teaches through how it is built: clear visuals, numbers you can move and compare, and the same plain words everywhere. Using it should be enough to learn how a company's finances fit together.

## What it covers

- US-listed public companies only.
- What each company reported in its filings, year by year.
- Where each dollar of revenue goes.
- What the company did with its money, and the notable things that happened to it.
- What the economy, the industry and share prices in general were doing at the time.

## What it is not

- It gives no advice on what to buy or sell.
- It does not forecast.
- It is not a replacement for reading the filings. It is a faster way into them.

## Status

Nothing is built yet. The project is at the stage of naming things and working out what to build.

## Where things are

| File or folder | What it holds |
| --- | --- |
| [`GLOSSARY.md`](./GLOSSARY.md) | The official words of the project, in the order to learn them. The tool uses these words and no others. |
| [`field-map.md`](./field-map.md) | A short map of the field: what it is called, what it includes, and where the data comes from. |
| [`docs/rfc/`](./docs/rfc/) | Open questions and ideas being explored. Start with its README. |
| `docs/adr/` | Decisions that were made, and why. This folder appears when the first decision is recorded. |

## How ideas become decisions

1. A question or an idea is written down as an RFC in `docs/rfc/`.
2. It is explored through research, a quick prototype, or discussion.
3. What was learned is written back into the RFC as its outcome.
4. If the outcome is a decision that would be hard to change later, it is also recorded as a short ADR in `docs/adr/`.
