---
status: open
opened: 2026-11-11
closed:
---

# An agent that does not invent numbers

## Question

How is the agent built so that every figure and every claim it gives comes from the company's filings, and how does each person who runs the tool connect their own language model?

## Why it matters

Language models state wrong figures with full confidence. An agent that does that inside a tool for learning finance does more harm than having no agent. And because the project is planned as open source, the agent cannot rest on one person's subscription.

## What we know

- A language model answering from memory gets financial figures wrong often enough to matter. This project saw it first hand when writing the glossary examples.
- A model can instead be given tools that look numbers up in the database and passages up in the filings, and be limited to answering from what those tools return.
- The terms of a personal subscription to a language model may not allow it to be used from another program. This needs checking for each provider.

## Open points

- Is the rule that the agent never writes a number itself, and only places numbers returned by a lookup?
- How is each sentence of an answer tied to the filing passage or reported number it rests on?
- What does the agent say when the filings do not contain the answer?
- Which ways of connecting a model are supported at first: a key from a provider, a model running on the same machine, or both?
- How is the agent tested? A fixed list of questions with known answers, run after every change, would show when it gets worse.
- Does the agent use the glossary's words only, and can it open a term card?
- What leaves the machine when a question is asked, and is the reader told?

## Outcome

