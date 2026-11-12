---
status: accepted
date: 2026-11-12
---

# The agent runs on the reader's own ChatGPT subscription, through Codex

The agent answers questions about a ready company through OpenAI's Codex SDK, which runs Codex with the ChatGPT sign-in the reader already made with `codex login`. The tool has no sign-in, registration or key of its own. Codex may use only the tool's lookups, through a small bridge that Codex starts and that asks the running tool for each lookup. Every figure in an answer comes from a lookup, and the screen draws each chart from the lookup's own result.

We chose this because the tool is meant to run on one person's computer without accounts, and a subscription the reader already pays for is the only way to use a language model that fits. Claude was left out because Anthropic does not allow an application to pass requests through a person's Claude plan. A key from a provider, paid by use, was left out by choice. The AI SDK was not needed: its own providers take only keys, and its community providers for subscriptions hide the tool calls the screen needs.

Explored in [An agent that does not invent numbers](../rfc/0007-an-agent-that-does-not-invent.md) and [The twenty questions the agent answers first](../rfc/0009-the-twenty-questions-the-agent-answers-first.md).

## Consequences

- Asking a question sends the question and the figures the lookups return to OpenAI. The database stays on the reader's computer, and every answer says so.
- The tool must be running for Codex to read its figures, because the lookups run inside it.
- If OpenAI stops letting the Codex SDK use a ChatGPT sign-in, the fallback is OpenAI's own sign-in for locally run apps, which needs no registration either.
- A question costs about 60,000 input tokens of the reader's plan, most of them Codex's own instructions.
