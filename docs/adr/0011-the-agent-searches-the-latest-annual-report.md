---
status: accepted
date: 2026-11-13
---

# The agent searches the latest annual report, and shows the passage under its answer

When a company is collected, the tool keeps the paragraphs of its latest annual report (10-K) in an SQLite full-text index, with its risk headings marked. The agent can search them, read lines from them and list the risk headings. An answer that uses the report shows up to two passages under it, with a link to the filing. A passage is shown only when its words are found in a paragraph a lookup returned during that answer.

We chose this because, without it, the agent could not answer who a company competes with, what its risks are or what it says about its year, which beginners ask about most after the figures. Measured with the eval in `evals/` on 13 November 2026, right answers rose from 63 to 74 of 74 on the companies used for tuning, and from 35 to 47 of 49 on the two held out. The details are in [Searching the text of annual reports](../rfc/0010-searching-the-text-of-annual-reports.md).

Search is by keyword, not by meaning: the agent writes the search words, and a test showed that leaves nothing for search by meaning to add, which would need a model of 300 MB or more on the reader's computer.

## Consequences

- A text answer takes about 8 seconds, against about 5 for a figures answer.
- Only the latest report is kept, so the agent cannot say what a company said in earlier years.
- Companies collected before this get their report text the first time it is searched.
- Every change to the agent is judged with `bun run eval` before and after, on the held-out companies as well as the tuning ones.
