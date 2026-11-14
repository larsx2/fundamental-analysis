---
status: accepted
date: 2026-11-13
---

# The agent keeps one Codex running, and reads the usual figures before asking

The tool now runs the reader's Codex as one long-running `codex app-server`, started when the Ask screen opens or the home page's question box is focused, and keeps a thread started and ready for the next question. Before each question it reads the lookups most answers need (where each dollar went, the balance sheet, cash, uses of cash, revenue, net income and free cash flow over ten years, returns, context, marks and the company) and puts their figures in the question. Codex can still call any lookup for what is not there. It runs on the same sign-in and plan as before; only the way the tool talks to Codex changed, from the Codex SDK to the app server it is built on.

We chose this because "Where does Costco Wholesale's money go?" took 19 seconds on screen, and only 0.02 seconds of that was reading figures. Measured on 13 November 2026 with Codex 0.167.2, the time went to:

- starting Codex for every question, then its own setup: about 2.5 seconds;
- a model trip spent finding the lookups, because Codex hides a server's tools until the model searches for them: about 4 seconds;
- a trip to call the lookup and a trip to write the answer: about 4 seconds each.

With the figures in the question, most answers take one model trip, and a ready thread skips the setup. The same question now answers in about 5 seconds; a question that needs a fresh lookup, such as inventory over ten years, in about 6.5.

The tool also stops loading the reader's own Codex setup into the agent: their list of skills, their hooks, and the instructions about permissions and the environment. This cut each question from about 65,000 input tokens to about 14,000, so a question uses far less of the reader's plan.

This replaces "through OpenAI's Codex SDK" in [The agent runs on the reader's own ChatGPT subscription, through Codex](0008-the-agent-runs-on-the-readers-chatgpt-subscription.md). Everything else there still holds.

## Considered and left out

- Fast mode: about a second quicker, but OpenAI charges it at 2.5 times the normal rate against the plan. It is the reader's to choose in their own Codex settings, and the tool follows that setting.
- Low reasoning effort, giving the lookups to the model as direct tools, and turning off the "world state" Codex builds each turn: none was faster beyond run-to-run noise.
- Calling the model with the token Codex saves: ruled out in [An agent that does not invent numbers](../rfc/0007-an-agent-that-does-not-invent.md).

## Consequences

- OpenAI calls the app server experimental, so a Codex update can change its messages. The Codex version is pinned in `package.json`, and moving it means asking a few questions to check the answers still arrive.
- One Codex process stays running while the tool runs, and ends with it.
- The screen still lists only the lookups an answer used: a figure read beforehand counts as read when the answer uses one of its figures or draws its chart.
- The reader's personal `AGENTS.md` instructions still reach the agent, because Codex has no setting to leave them out.
