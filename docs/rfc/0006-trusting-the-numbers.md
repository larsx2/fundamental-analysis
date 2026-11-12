---
status: exploring
opened: 2026-11-11
closed:
---

# How we know a number on screen is right

## Question

What checks make it safe to believe a figure the tool shows, without opening the filing to confirm it?

## Why it matters

A learner cannot tell a wrong number from a right one. That is the whole reason they are using the tool. When this project's glossary examples were first written from memory and then checked against the filings, 13 of 76 needed correcting. Collected data will have its own errors, and they will be harder to see.

## What we know

- Financial statements contain rules that must always hold. Assets equal liabilities plus equity. Gross profit equals revenue minus cost of revenue. The lines of a statement add up to its totals.
- Every reported number in SEC data carries the filing it came from and the period it covers.
- The SEC publishes the same numbers in more than one form, so one can be checked against another.

## Options

### Settled on 11 November 2026: show and mark

Nothing unsure is hidden, and nothing unsure is shown as if it were certain.

- A number that fails a check still appears, marked as a doubtful number, with the check it failed.
- A term the company does not report appears as a gap with a short note, never as zero.
- A term worked out from others appears marked as a calculated number.
- A company with doubtful numbers still becomes ready.
- When a filed figure breaks its term's own definition, the calculated number is shown and the filed figure stays attached, marked as doubtful. Settled with [the decision on definitions and differences](../adr/0006-definitions-win-differences-are-shown.md).

## Open points

- Which rules are checked for every company and every fiscal year, and what happens to a year that fails one?
- Is there a small set of companies whose numbers are confirmed by hand once and then used to catch mistakes after every change?
- How does the reader see where a number came from: a link on every figure, or a mode that turns sources on?
- What do the marks for doubtful and calculated numbers look like, so they are noticed without shouting?

## Outcome
