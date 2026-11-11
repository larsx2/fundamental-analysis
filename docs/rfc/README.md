# RFCs

An RFC is one question or one idea, written down so it can be explored before anything is decided. It might be a possible feature, a data source to evaluate, or a way of showing something on screen.

RFCs are where the thinking happens. Decisions that come out of them are recorded separately, in `docs/adr/`.

## How RFCs and ADRs differ

|                   | RFC                                           | ADR                               |
| ----------------- | --------------------------------------------- | --------------------------------- |
| Holds             | A question, the options, and what was learned | One decision and its reason       |
| Written           | Before the answer is known                    | After the answer is known         |
| Length            | As long as the exploring needs                | One to three sentences            |
| Changes over time | Yes, until it is closed                       | No. A new ADR replaces an old one |

## Files

Each RFC is one file in this folder, named with a four-digit number and a short name: `0001-company-timeline.md`, `0002-filing-data-source.md`.

To pick the next number, find the highest one in this folder and add one. Numbers are never reused.

Start a new RFC by copying [`TEMPLATE.md`](./TEMPLATE.md).

## Status

Every RFC carries one status at the top of the file.

- `open`: written down, not yet explored.
- `exploring`: research or a prototype is under way.
- `closed`: explored, and the outcome is written in the RFC.
- `dropped`: no longer worth pursuing. The reason is written in the RFC.

## What goes in an RFC

Only two parts are required: the question, and why it matters. Add the others when there is something real to put in them.

- **Question.** The single thing this RFC wants answered.
- **Why it matters.** What it would unlock or what goes wrong without it.
- **What we know.** Facts already established, each with its source.
- **Options.** The ways it could go, and what each one costs and gives.
- **Open points.** Smaller questions that must be answered first.
- **Outcome.** What was learned and what follows from it. Filled in when the RFC is closed or dropped.

## Rules

- One question per RFC. If a second question appears, give it its own RFC and link the two.
- Use the words in [`GLOSSARY.md`](../../GLOSSARY.md). If an RFC needs a word that is not there, add it to the glossary first.
- A claim about the outside world carries its source.
- Refer to another RFC or ADR by its title, with the link behind it, not by its number alone.

## When an RFC is closed

Write the outcome in the RFC. Then record an ADR only if the outcome is a decision that meets all three of these:

1. It would be costly to change later.
2. Someone reading the project later would wonder why it was done this way.
3. There were real alternatives, and one was picked for a specific reason.

If it does not meet all three, the outcome in the RFC is the whole record. If it does, link the ADR from the RFC's outcome and name the RFC in the ADR.

ADRs live in `docs/adr/`, numbered the same way: `0001-short-name.md`. An ADR can be a single paragraph: the situation, what was decided, and why.
