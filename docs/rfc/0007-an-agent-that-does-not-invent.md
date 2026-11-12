---
status: closed
opened: 2026-11-11
closed: 2026-11-12
---

# An agent that does not invent numbers

## Question

How is the agent built so that every figure and every claim it gives comes from the company's filings, and how does each person who runs the tool connect their own language model?

## Why it matters

Language models state wrong figures with full confidence. An agent that does that inside a tool for learning finance does more harm than having no agent. And because the project is planned as open source, the agent cannot rest on one person's subscription.

## What we know

- A language model answering from memory gets financial figures wrong often enough to matter. This project saw it first hand when writing the glossary examples.
- A model can instead be given tools that look numbers up in the database and passages up in the filings, and be limited to answering from what those tools return.
- The terms of a personal subscription to a language model may not allow it to be used from another program. This was checked for Claude and ChatGPT on 11 November 2026, and the next five points are what came back.
- Claude: a person may sign in to the unmodified Claude Code program with their own subscription, and that use counts against their plan's limits. A developer may not offer Claude sign-in inside their own application or pass requests through a person's plan on their behalf. Developers building on the Agent SDK are told to use a key. Source: [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance), section "Authentication and credential use", and [Use the Claude plan usage limits](https://support.claude.com/en/articles/15036540-use-the-claude-plan-usage-limits).
- Claude's rules on this changed four times in 2026: banned in February, enforced in April, restored in May, and the planned separate allowance paused in June. Anthropic says it may enforce without notice. Source: [The Register, 20 February 2026](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access) and the support page above.
- ChatGPT: since 29 September 2026 OpenAI lets a Plus or Pro subscriber pay for another application's requests from their plan, and its developer documents are written for open-source applications that run on the person's own machine. Paid or hosted products must apply. Source: [Sign in with ChatGPT terms](https://openai.com/policies/sign-in-with-chatgpt-terms/), which could not be opened by a program and was read through [WorkOS's summary](https://workos.com/blog/sign-in-with-chatgpt-plan-usage-scope). The summary does not say whether the model can call the application's own tools on this route, so that is not confirmed.
- The AI SDK reaches both subscriptions through community packages that run the person's own Claude Code or Codex program. Neither accepts tools defined in the application's code. Both accept tools offered by an MCP server, which is a small separate program that a model can ask for data. Source: [Claude Code provider](https://ai-sdk.dev/providers/community-providers/claude-code) and [Codex CLI provider](https://ai-sdk.dev/providers/community-providers/codex-cli).
- The AI SDK's own Anthropic and OpenAI providers take a key from the provider and nothing else, so they cannot be used here. The community providers for Claude Code and Codex reach a subscription only by running that program, signed in by the person, and their pages list tool calls as not shown to the application. So when a model runs inside Claude Code or Codex, the screen cannot learn which figures it looked up from the model's side. The lookups server can record each result it returns, so the screen draws the figures and charts from that record rather than from the model's reply. Source: the provider pages linked above.
- Three ways reach a person's ChatGPT plan from a local tool, checked on 12 November 2026. Running the Codex program the person has installed and signed in with `codex login`: the tool adds no sign-in of its own, and an AI SDK community provider does this; tools reach the model only through an MCP server, and the tool does not see the calls. OpenAI's own sign-in for open-source and locally run apps: the first sign-in issues the app's ID by itself, with no form, secret or approval, and the app calls `https://api.openai.com/v1/responses` with the token; its own tools must be grouped in namespaces, and fields such as `temperature` are rejected. Reading the file where Codex keeps its sign-in (`~/.codex/auth.json`): an unofficial package does it and sends requests to `chatgpt.com`, which OpenAI's docs say not to do ("do not point it at ChatGPT's `backend-api` endpoints"). Sources: [Codex CLI provider](https://ai-sdk.dev/providers/community-providers/codex-cli), [OpenAI: models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [OpenAI: sign in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [OpenAI: Codex app server](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server), [assistant-ui](https://www.assistant-ui.com/docs/guides/chatgpt-subscription).
- OpenAI's Codex SDK (`@openai/codex-sdk` 0.167.2, Apache-2.0) runs a copy of Codex it ships with, and sends a key only when given one. Tried on 12 November 2026 on a computer signed in with `codex login` to a ChatGPT account, run by Bun: it answered on that plan with no key, sign-in or registration. A sample lookup served as an MCP server was called, and the app received each call as an `mcp_tool_call` item with its arguments and its result, so the screen can draw from the lookup's own result. The settings that made it work: `sandboxMode: "read-only"`, `approvalPolicy: "never"`, `networkAccessEnabled: false`, `webSearchMode: "disabled"`, and `default_tools_approval_mode: "approve"` on the lookups server; without that last one, Codex refused the call because it could not ask for approval. One question took about 8 seconds and 60,000 input tokens, most of them Codex's own instructions, 40,000 of them cached.
- In that try the model subtracted two figures and wrote the difference itself. Lookups have to return every change and share already worked out, and the agent's instructions have to forbid arithmetic.
- The database holds reported numbers, the list of filings and each company's business description. It does not hold the text of the filings, so an agent built today can answer from numbers and cannot quote a passage.

## Options

### Settled on 12 November 2026: the reader's ChatGPT subscription, through their own Codex

The agent runs only on the reader's own ChatGPT subscription. The tool runs Codex through OpenAI's Codex SDK, which uses the sign-in the reader already made with `codex login`, and adds no sign-in, registration or key of its own. The AI SDK is not needed. Claude is left out: Anthropic forbids an application from passing requests through a person's plan. A key from a provider, paid by use, is not offered.

If the Codex SDK stops reusing that sign-in, the fallback is OpenAI's own sign-in for locally run apps, which needs no registration either. Reading Codex's saved sign-in directly is ruled out, because it relies on an unofficial package and an address OpenAI says not to use.

### Lookups first, as an MCP server

Write the lookups as one small MCP server over the database: find a company, give its reported numbers for a glossary term across fiscal years, give its statements, give a glossary term's definition, and list its filings.

- Gives: the form of tool Codex accepts, so the lookups are written once and the chat panel reuses them. It works the day it is finished from Codex in a terminal, on the person's own ChatGPT subscription, with no chat screen and inside OpenAI's rules. The fixed list of test questions can run against it before any screen exists.
- Costs: the first agent lives outside the tool's own screens.
- Rules out: nothing. A chat panel is added on top later.

### A chat panel in the tool, running the reader's own Codex

Add a panel on each company screen that runs the Codex already signed in on the computer, with the lookups attached.

- Gives: the agent sits beside the figures it talks about, and a term card can open from an answer.
- Costs: the reader signs in once with `codex login`. Each question carries Codex's own instructions, about 60,000 tokens, against the reader's plan limits.
- Rules out: nothing, but it puts the visible part ahead of the part that keeps the agent honest.

### Sign-in with a subscription inside the tool

- Gives: one click for the reader.
- Costs: Claude's rules do not allow it. ChatGPT's allow it for locally run open-source apps with no registration, but the tool then keeps and refreshes its own sign-in, and groups its tools in namespaces.
- Rules out: nothing. It stays the fallback if running Codex hides too much.

## Open points

- Is the rule that the agent never writes a number itself, and only places numbers returned by a lookup?
- How is each sentence of an answer tied to the filing passage or reported number it rests on?
- What does the agent say when the filings do not contain the answer?
- What does the tool say when Codex is not installed or not signed in?
- How is the agent tested? A fixed list of questions with known answers, run after every change, would show when it gets worse. The list, and the lookups built for it, are explored in [The twenty questions the agent answers first](./0009-the-twenty-questions-the-agent-answers-first.md).
- Does the agent use the glossary's words only, and can it open a term card?
- What leaves the machine when a question is asked, and is the reader told?

## Outcome

Built on 12 November 2026, and recorded in [The agent runs on the reader's own ChatGPT subscription, through Codex](../adr/0008-the-agent-runs-on-the-readers-chatgpt-subscription.md).

- The model never writes a number of its own. Lookups return every figure already written out, with every change worked out, and the Ask screen marks any number in an answer that no lookup gave.
- Each figure in an answer points at the lookup it came from, and the column beside the answer lists every lookup and filing read.
- When the collected data cannot answer, the agent says so and names what is not collected. It does not answer from memory, and it gives no advice on buying.
- The answer's words use the glossary's terms, and each term opens its card.
- Under every answer, the reader is told that the question and its figures went to OpenAI and the database stayed on their computer.
- Testing against a fixed list of questions is explored in [The twenty questions the agent answers first](./0009-the-twenty-questions-the-agent-answers-first.md). The lookups have tests; running the questions themselves is still to do.
