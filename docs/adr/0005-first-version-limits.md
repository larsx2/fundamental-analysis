---
status: accepted
date: 2026-11-11
---

# The first version shows fiscal years only, with no share prices and no agent

Two parts of this were changed later. The agent was built after the screens, as recorded in [The agent runs on the reader's own ChatGPT subscription, through Codex](0008-the-agent-runs-on-the-readers-chatgpt-subscription.md). History reaches back to about fiscal 2007, as recorded in [A term's definition wins over a filed figure, and every difference is shown](0006-definitions-win-differences-are-shown.md).

The first version leaves three things out on purpose.

- **No quarters.** Every chart and table moves one fiscal year at a time, because the fourth quarter is never reported by itself and would have to be worked out and checked.
- **No share prices or index values.** These usually cannot be shared freely, and the project is planned as open source. So the first version has no market capitalization, market context, event study or valuation.
- **No agent.** It depends on numbers already proven right and on the text of the filings, so it is built straight after the screens.

History also starts around 2009, when filings began to be published in a form a program can read.

Each of these is a limit of the first version, not of the tool. Lifting one needs its own RFC.

Explored in [Which screens the first version needs](../rfc/0002-first-version-site-structure.md).
