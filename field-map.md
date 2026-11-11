# What this field is called, and what it covers

## The names

**Fundamental analysis** is the name of the discipline. It means judging a company by its business and its numbers, not by its share price chart.

**Security analysis** is the older, classic name for the same thing. It comes from the 1934 book by Benjamin Graham and David Dodd. A "security" is any tradable claim on a company, such as a share or a bond.
**Equity research** is the name of the job. Analysts at banks and funds do this for a living, and the report they write on one company is called an **initiation report** or a **company primer**.

**Financial statement analysis** is the core skill inside it: reading the reports a company files and working out what they say.

What you describe building is usually called an **equity research terminal** or a **fundamental research workbench**. Bloomberg Terminal, Koyfin, FinChat and Quartr are commercial versions.

## What is not this

**Technical analysis** studies price charts and trading patterns. It ignores the business.

**Quantitative investing** uses statistics across thousands of shares at once. It does not try to understand any single company.

**Macroeconomics** studies the whole economy. You need a little of it as background, but it is a separate field.

**Personal finance and portfolio construction** decide how much of your money goes into shares, bonds, property and cash. This matters more for your results than picking companies, and it is a different subject.

## The pieces of the field

### 1. The three financial statements

Every public company publishes these every quarter.

- **Income statement.** What it sold, what it spent, and what was left as profit over a period.
- **Balance sheet.** What it owns and what it owes on one specific day.
- **Cash flow statement.** The actual cash that came in and went out, split into running the business, investing, and financing.

The three connect. Learning how they connect is the single most valuable thing to study first.

### 2. The source documents

In the United States, companies file these with the regulator (the SEC), and all of them are free on a public database called **EDGAR**.

- **10-K.** The annual report. It includes a plain-language description of the business, the risks, and management's own explanation of the year.
- **10-Q.** The quarterly version.
- **8-K.** A notice of something important that just happened, such as an acquisition or a chief executive leaving.
- **Proxy statement.** How executives are paid and who controls the votes.
- **Earnings call transcript.** Management presenting results and answering analysts' questions. Not an SEC filing, but widely available.

The numbers in these filings are also published in a machine-readable format called **XBRL**. That is what makes your tool practical to build.

### 3. Ways of reading the numbers

- **Year-over-year analysis** (also called horizontal analysis). How each line changed against the same period a year earlier.
- **Common-size analysis** (also called vertical analysis). Every line shown as a share of revenue, so you can see where each dollar goes. This is the "distribution of expenses and income" you asked for.
- **Segment analysis.** Revenue and profit split by product line and by region.
- **Ratio analysis.** Standard measures of profit margin, growth, debt load, and how well the company turns investment into profit.
- **Unit economics.** What the company earns and spends per customer, per store, or per unit sold.

### 4. Understanding the business itself

- **Business model.** Who pays, for what, and how often.
- **Competitive advantage** (often called a "moat"). Why competitors cannot simply copy it.
- **Industry analysis.** Who the rivals, suppliers and customers are, and who holds the power.
- **Capital allocation.** What management does with the profit: reinvest, buy other companies, pay down debt, pay dividends, or buy back shares. Following these decisions over time is the "history of decisions" you want to trace.

### 5. Context around the company

- **Economic backdrop.** Interest rates, inflation, and recessions at the time each decision was made.
- **Industry cycle.** Whether the whole sector was booming or shrinking.
- **Event study.** The formal name for measuring how a share price reacted to a specific announcement. This is the "correlation with news" part of your idea.

### 6. Valuation

Working out what a company is worth, compared with its current price.

- **Multiples.** Price compared with profit, sales or cash flow, set against similar companies.
- **Discounted cash flow.** Estimating all the future cash the business will produce and what that is worth today.

Valuation comes last. It only means something once you understand the pieces above.

## How this maps to your tool

| What you asked for                  | What it is called                              | Where the data comes from                              |
| ----------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| Year-over-year progress             | Horizontal analysis                            | XBRL data from EDGAR                                   |
| Distribution of expenses and income | Common-size and segment analysis               | XBRL data, plus notes in the 10-K                      |
| History of decisions                | Capital allocation history, corporate timeline | 8-K filings, 10-K text, call transcripts               |
| Market context at the time          | Macro and industry backdrop                    | FRED, the US central bank's free data service          |
| Correlation with news               | Event study                                    | Price history plus dated filings and news              |
| An agent that explains it           | Research assistant over filings                | Your language model subscription reading the documents |

## A realistic boundary for a first version

In scope: United States listed companies, ten or more years of filings, the three statements, year-over-year and common-size views, a timeline of major events, and an agent that answers questions from the filings themselves.

Out of scope at first: valuation models, forecasts, live prices, buy or sell signals, and companies listed outside the United States. Non-US markets have no free equivalent of EDGAR, so the data work is much harder.

## One honest caution

Understanding 100 companies well does not by itself lead to beating the market. Most professional analysts, with far better tools, do not beat a plain index fund after costs. The realistic payoff of this project is that you will read the business world far more clearly and avoid bad decisions. That is worth a lot, but it is a different thing from picking winners.

## Where to learn the foundations

- _The Intelligent Investor_ by Benjamin Graham. The mindset.
- _Financial Statements_ by Thomas Ittelson. The three statements, from zero.
- _The Outsiders_ by William Thorndike. Capital allocation told through eight chief executives.
- Aswath Damodaran's free valuation course from New York University, on YouTube.
- Warren Buffett's annual letters to Berkshire Hathaway shareholders, free online.
