---
status: exploring
opened: 2026-11-12
closed:
---

# The twenty questions the agent answers first

## Question

Which twenty questions about a company should the agent answer well first, which lookup answers each one, and how does each answer show its figures?

## Why it matters

The agent is not there to do whatever a person asks. It is there to help a beginner understand the figures the tool has collected, and to teach while it does. A fixed list of the questions beginners actually ask decides which lookups to build, which data is still missing, and what each answer draws. The same list is the test the agent is run against after every change, which [An agent that does not invent numbers](./0007-an-agent-that-does-not-invent.md) leaves open.

## What we know

- Beginner checklists start in the same places: what the company does and how it makes money, whether it is growing, its margins and cash, its debt, its competitive advantage, its management and its risks. Sources: [Motilal Oswal](https://www.motilaloswal.com/learning-centre/2020/2/8-questions-you-must-always-ask-about-the-fundamentals-of-the-company), [Kiplinger](https://www.kiplinger.com/article/investing/t052-c032-s014-6-critical-investment-questions.html), [Alumnus Capital's beginner guide](https://medium.com/the-catalyst-by-alumnus-capital/introductory-guide-to-analyzing-stocks-part-1-objective-research-bc38a93739b3), [Investimate](https://investimate.substack.com/p/my-complete-stock-analysis-framework).
- Peter Lynch's "two-minute drill" in _One Up on Wall Street_ asks why the company is interesting, what has to happen for it to succeed, and what stands in its way. Source: [The Investor's Podcast summary](https://www.theinvestorspodcast.com/billionaire-book-club-executive-summary/executive-summary-one-up-on-wall-street/).
- People on Reddit who read annual reports say there is no fixed list, and point to free cash flow, growth, understanding the business and comparing with competitors. Source: [r/stocks](https://www.reddit.com/r/stocks/comments/1dtcwgm/). Another guide adds reading how candid management is, and reading competitors' annual reports. Source: [Steady Investing](https://thesteadyinvesting.substack.com/p/how-to-analyze-an-annual-report-10).
- Surveys of investors rank the financial statements as the most useful part of an annual report, and the risks the company lists second. One UK survey found 85% thought the statements very useful and 54% the risks. Sources: [ACCA](https://www.accaglobal.com/content/dam/acca/global/PDF-technical/financial-reporting/pol-afb-ui02.pdf), [a Korean study](https://www.koreascience.or.kr/article/JAKO201616759692187.pdf). Both come from outside the US, and the figures were read from search summaries, not from the full papers.
- Investopedia's own pages did not come up in search, so it is not used yet.
- The question asked most of all, whether to buy, needs share prices and a forecast. The first version has neither, on purpose: see [The first version shows fiscal years only, with no share prices and no agent](../adr/0005-first-version-limits.md).
- The database holds the income statement lines, earnings per share, the balance sheet lines, and the cash flow lines including capital expenditure, dividends, share buybacks, acquisitions and debt raised and repaid. It holds each company's filings, with the item numbers of its current reports (8-K), the opening of its business description, and the US interest rate, inflation and recessions. It does not hold segments, the number of shares, short-term investments, interest or tax on their own, or any text of the filings beyond the opening of the business description.
- The [prototype design research](./0001-prototype-look-and-feel.md) suggested placing a source list beside written analysis, showing what was read and the progress of each lookup. This tool also needs each figure to point to its source and must avoid investment judgements.

## Options

### The twenty questions

"Collected" says whether the data to answer is in the database today.

| #   | Question                                                                 | Lookup            | Collected                                                                              | What the answer shows                                                                                             |
| --- | ------------------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | What does the company do, and how does it make money?                    | company           | Partly. Only the opening of the business description; segments are missing.            | The company's own words with the filing link, and revenue for the latest fiscal year.                             |
| 2   | Which products or places does its revenue come from?                     | segments          | No. Segments are not collected.                                                        | Revenue split by segment, drawn like the one-dollar bar.                                                          |
| 3   | Is it growing?                                                           | trend             | Yes                                                                                    | Revenue and net income as two small lines over ten fiscal years, with the compound annual growth rate.            |
| 4   | Has its growth been steady?                                              | trend             | Yes                                                                                    | One bar per fiscal year for revenue's year-over-year change, with each fall marked.                               |
| 5   | Where does each dollar of revenue go?                                    | dollar            | Yes                                                                                    | The one-dollar bar from the Overview.                                                                             |
| 6   | Is anything left after its costs, and are its margins rising or falling? | trend             | Yes                                                                                    | Gross margin, operating margin and net income as a share of revenue, over ten fiscal years.                       |
| 7   | Does its net income turn into cash?                                      | cash              | Yes                                                                                    | Net income beside free cash flow for each fiscal year.                                                            |
| 8   | How much debt does it have, and could it pay it back?                    | balance           | Partly. Without short-term investments, cash reads too low and net debt too high.      | Debt, cash and net debt on the last day of the fiscal year, against one year of operating cash flow.              |
| 9   | What does it own, and what does it owe?                                  | balance           | Yes                                                                                    | Assets beside liabilities and equity, as two stacked bars.                                                        |
| 10  | What does it do with its cash?                                           | cash uses         | Yes                                                                                    | Its uses of cash for each fiscal year, as on the Timeline.                                                        |
| 11  | Does it pay a dividend, and has it grown?                                | cash uses         | Partly. Only the total paid, not the amount per share.                                 | Dividends paid across fiscal years.                                                                               |
| 12  | Is it buying back its shares or issuing more?                            | cash uses         | Partly. Without the number of shares, dilution cannot be shown.                        | Share buybacks beside stock-based compensation across fiscal years.                                               |
| 13  | How much does it spend on its future?                                    | trend             | Yes                                                                                    | Research and development and capital expenditure as cents of each dollar of revenue, across fiscal years.         |
| 14  | How well does it use the money put into it?                              | returns           | Partly. Tax is not collected on its own, so return on invested capital is approximate. | One figure per fiscal year, with how it was worked out.                                                           |
| 15  | Who does it compete with, and what is its competitive advantage?         | passages          | No. Needs the text of the annual report.                                               | Passages quoted from the annual report, with links. The agent never judges the advantage itself.                  |
| 16  | What are the main risks?                                                 | passages          | No. Needs the text of the annual report.                                               | The headings of the risks the company lists, quoted with links.                                                   |
| 17  | What does the company say about its year?                                | passages          | No. Needs the text of the annual report.                                               | Passages quoted from the company's own discussion of the year.                                                    |
| 18  | What was happening around it?                                            | context           | Yes                                                                                    | The Timeline's strip for the fiscal years asked about: corporate events, interest rate, inflation and recessions. |
| 19  | How did it do in the last recession, or when interest rates rose?        | context and trend | Yes                                                                                    | Revenue and net income with the recession or the rise in rates shaded behind them.                                |
| 20  | Can I trust these numbers?                                               | trust             | Yes                                                                                    | The figures asked about with their marks (restated, calculated, doubtful, gap) and the filing each came from.     |

Eleven are answered in full today, five in part, and four not at all.

Two questions always get the same kind of answer:

- **"Should I buy it?" or "Is it cheap?"** The agent says it cannot answer: the tool has no share prices and makes no forecasts. It explains the words the question needs, such as valuation and price-to-earnings ratio, from the glossary, and offers questions 3, 7 and 10.
- **"How does it compare with another company?"** Comparing companies is parked in the first version. The agent answers for each company the reader has collected, one after the other, and says so.

### The lookups behind them

The agent can use these lookups and nothing else: no web, no files, no running code. Each one is built for a kind of question about the collected data.

- **company**: the company's name, ticker, fiscal year end, fiscal years collected and business description.
- **trend**: one or more terms across fiscal years, with year-over-year changes and the compound annual growth rate.
- **dollar**: where each dollar of revenue went in one fiscal year.
- **cash**: net income, operating cash flow and free cash flow across fiscal years.
- **balance**: assets, liabilities, equity, cash, debt and net debt on the last day of each fiscal year.
- **cash uses**: capital expenditure, dividends, share buybacks, acquisitions and debt repaid, across fiscal years.
- **returns**: return on invested capital, with how it was worked out.
- **context**: corporate events and the economic context for a span of fiscal years.
- **trust**: the marks on any figure, and the filing it came from.
- **glossary term** and **filings**, for every question.
- Two need data that is not collected yet: **segments**, and **passages** from the text of the annual report.

Each lookup returns two things: the figures, each with the filing it came from or how it was worked out, and which drawing shows them. The screen draws. The model picks the lookup and writes the words around the figures. This is what lets an answer carry a chart without the model ever writing a number.

### How an answer looks

- The first line answers the question in plain words. The figures follow in a sentence or two.
- At most one drawing, taken from the screens the tool already has: the one-dollar bar, the small lines of the Overview, the uses of cash from the Timeline, rows from the Statements. A drawing is used only when it shows something a sentence cannot, such as a trend or a split.
- What the agent read sits beside the answer, saying how much: "Revenue, 12 fiscal years" or "Annual report (10-K) filed on 7 October 2026". Each line shows "Reading" while the answer is written.
- Every figure points at the line it came from, and nothing is an investment judgement. A short finding is allowed only when it is a fact, such as "Revenue grew in 11 of 11 fiscal years".
- The answer ends with where to look next, as the Overview does, and every term opens its card.

### How the list tests the agent

Each question is asked about Apple, Costco and Microsoft: sixty answers. The expected figures come from the annual reports, not from the tool's own output, as the rules for tests in `todo.md` require. A run passes when every figure in every answer matches and came from a lookup. The questions not yet collected must get an answer that says it cannot answer and names what is missing.

## Open points

- Are these the right twenty? The list rests on blogs, one book and two surveys from outside the US. Nobody new to the field has been asked yet.
- Should segments and the text of the annual report be collected before the agent is built, or should it ship answering the sixteen it can answer today?
- Short-term investments are needed for question 8. The review of the Overview already found that cash misleads without them.
- One drawing per answer, or none when a sentence is enough?
- How is a passage quoted from a filing kept to what the filing says, the way a figure is kept to what a lookup returns?

## Outcome
