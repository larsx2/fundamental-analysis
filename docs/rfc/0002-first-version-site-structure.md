---
status: closed
opened: 2026-11-11
closed: 2026-11-11
---

# Which screens the first version needs

## Question

What is the smallest set of screens that lets someone with no background understand one public company, and then do the same for the next ninety-nine?

## Why it matters

Every screen added is a screen to design, fill with data and keep correct. The first version should hold only the screens without which the tool fails at its one job, and name the rest as later work so they stop competing for attention.

## Options

### Settled on 11 November 2026

- **The first slice.** The first thing built end to end with real data is: search for one company, collect it, and show "Where the money goes" across its fiscal years. It needs seven terms: revenue, cost of revenue, gross profit, research and development, selling general and administrative, operating income and net income.
- **The agent comes after.** The first version is the Companies list, the four company screens, the Glossary and the term card. The agent is built next, on data already proven right.
- **Fiscal years only.** Nothing in the first version is shown by quarter.
- **The slice is proven on three companies.** Apple, because the glossary examples use it. Costco, because it reports no research and development and labels its costs differently. Microsoft, because its fiscal year ends in June and its filing labels differ again.
- **The term card is in the slice.** Clicking a term on the money flow screen opens its glossary entry, read from the glossary file.
- **The slice is finished quality.** Its one screen is taken all the way in the chosen look, and later screens reuse what it settles.
- **The drawing form is chosen by trying.** Two quick throwaway versions of the money flow, a flow diagram and stacked bars, are made with Apple's real figures and judged by eye.
- **The Overview quotes the company.** Its description of the business is the opening of the company's own description in its annual report (10-K), with a link to the filing.
- **Two kinds of corporate event.** The Timeline shows only the kinds the SEC's own labels identify without guessing: a change of chief executive or finance chief, and a completed acquisition or sale of a business.
- **Economic context is in.** Interest rate, inflation and recessions, from the US central bank's free public data.
- **History starts around 2009**, when filings began to be published in a form a program can read.
- **No share prices.** The first version holds no share price or index data. Market capitalization, market context, event studies and valuation wait until a source anyone may use is found.

### Recommended: three places and one helper

```
Companies                      the collected ones, and search across all
└── Company                    one company, full screen
    ├── Overview               what it is and how it has done
    ├── Where the money goes   one fiscal year, dollar by dollar
    ├── Statements             the three statements, ten fiscal years
    └── Timeline               numbers, actions and context together
Glossary                       every term, in learning order

Available on every screen:
    Term card                  opens when any term is clicked

Built straight after the first version:
    Agent                      answers questions about what is on screen
```

### What each screen is for

Each screen answers one question a beginner would ask, in the order they would ask it.

**Companies.** "Which company do I look at?"
A plain list of the public companies already collected, with name, ticker, industry, and revenue for the latest fiscal year. Search by name or ticker covers every public company, and choosing one that is not collected yet offers to collect it. Nothing else. This is the home screen. How collecting on demand works is explored in [Which companies are covered, and how they get in](./0005-which-companies.md).

**Company, Overview.** "What is this company and is it growing?"
- One paragraph on the business model, in plain words.
- Revenue and net income for the last ten fiscal years as the main chart.
- A strip of key figures for the latest fiscal year: revenue, year-over-year change, gross margin, operating margin, net income, free cash flow, cash, debt.

**Company, Where the money goes.** "Out of every dollar it takes in, where does it go?"
- A common-size view of one fiscal year: revenue on one side, splitting into cost of revenue, research and development, selling general and administrative, and what remains as operating income and net income.
- A control to move through the fiscal years and watch the split change.
This is the screen that teaches the income statement without calling it a lesson.

**Company, Statements.** "Show me the real numbers."
- The income statement, balance sheet and cash flow statement as three tabs.
- Fiscal years as columns, ten or more.
- Every number links to the place in the filing it came from.

**Company, Timeline.** "What did it do, and what was going on at the time?"
One horizontal timeline across ten or more fiscal years, in stacked rows that share the same time axis:
- Revenue and net income.
- Capital allocation: acquisitions, share buybacks, dividends, capital expenditure, debt raised or repaid.
- Corporate events, taken from current reports (8-K).
- Economic context: interest rate, inflation, recessions.
Selecting any point in time shows everything that was true at that moment.

**Glossary.** "What does this word mean?"
The glossary as a browsable page, in the same learning order as `GLOSSARY.md`.

**Term card.** Clicking any term anywhere opens its definition, its example and, where possible, this company's own figure for it.

**Agent, after the first version.** A panel that can be opened on any company screen. It answers questions using that company's filings and always shows which filing each answer came from.

### Left for later

| Screen or feature | Why it can wait |
| --- | --- |
| Comparing two companies side by side | One company must be understandable first. |
| Segments | Segment data is reported differently by every company and needs its own exploring. |
| Industry context | Needs a reliable way to group rivals. |
| Market context and event study | Both need share prices or index values, and the first version holds none. |
| Quarters | The fourth quarter is never reported by itself and would have to be worked out. |
| Valuation | The tool's first job is understanding the business, not pricing it. |
| Reading filings inside the tool | A link out to the filing is enough at first. |
| Accounts, settings, saved lists | The tool runs locally for one person. |

### A smaller alternative

Drop the Timeline, leaving Companies, Overview, Where the money goes, Statements and Glossary. This could be built from the reported numbers alone. It is not recommended, because the timeline is the reason this tool exists and the part no free tool does well.

## Outcome

Closed on 11 November 2026. The first version is three places and one helper: the Companies list, a Company with four screens (Overview, Where the money goes, Statements, Timeline), the Glossary, and the term card on every screen. The agent is built straight after.

Everything under "Settled on 11 November 2026" above is decided. The limits of the first version are recorded in [The first version shows fiscal years only, with no share prices and no agent](../adr/0005-first-version-limits.md).

**Left to settle while building**

- Whether the term card can show the company's own figure for every term, or only for terms that map to a reported number.
- Where a person enters the contact details the SEC asks for. The working assumption is that the tool asks once, the first time a company is collected, and keeps them on that person's machine.
- The order of the screens after the slice. The working assumption is Statements, then Overview, then Timeline, then the Glossary page.

**Moved elsewhere**

- How each person connects their own language model is in [An agent that does not invent numbers](./0007-an-agent-that-does-not-invent.md).
