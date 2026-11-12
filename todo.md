# TODO: the first version

The work to get from an empty repository to the first version, in the order to do it.

Decisions are not repeated here. They live in [`docs/adr/`](./docs/adr/) and [`docs/rfc/`](./docs/rfc/), and each task names the ones it rests on.

## Where this is going

**The first slice.** Search for a company, collect it, and see "Where the money goes" across its fiscal years, with a working term card, at finished quality. Proven on Apple, Costco and Microsoft.

**The first version.** The Companies list, four company screens (Overview, Where the money goes, Statements, Timeline), the Glossary, and the term card on every screen.

**Done means.** After 30 minutes with one company, a person can say how it makes money, where each dollar of revenue goes, whether it is growing, what it did with its money, and what was happening around it.

## Order

```
Part 1  Prove the pieces start together          T01 to T03
Part 2  Numbers in the terminal                  T04 to T11
Part 3  Collecting on demand                     T12 to T14
Part 4  The slice's screen                       T15 to T20
Part 5  The rest of the first version            T21 to T30
Part 6  Before publishing                        T31 to T33
```

Parts 1 to 4 are the first slice and are broken down in full. Part 5 is deliberately coarser. The slice will teach things that change it, so each of its tasks gets broken down when it is reached.

The riskiest work comes first: whether the stack runs on Bun, then whether filing data can be turned into glossary terms correctly.

## Rules for every task

- A task is done when `task ci` passes and its "Check" has been carried out.
- Screens and messages use the words in [`GLOSSARY.md`](./GLOSSARY.md) and no others.
- Collected data is never committed. Tests use small made-up data in the same shape as the SEC's, or small extracts of the SEC's public data for Apple, Costco and Microsoft, trimmed to the tags the tests need and kept beside the tests. `task ci` never reaches the SEC.
- Exact versions are fixed for everything installed.
- Before adopting anything new, confirm its licence allows sharing under MIT.
- Commits follow the conventional commits format.
- Comments in code only say what the code cannot, such as a reason or an outside rule. Nothing that restates the code.
- Each task lists the Effect ideas it introduces, because learning Effect is a goal. The first use of each one gets a plain explanation in [`docs/learning-effect.md`](./docs/learning-effect.md), not in a comment.

## Rules for tests

The aim is a few dozen tests for the first slice that each catch something real, not hundreds that pass whatever the code does.

- A test is kept only if it names the mistake it catches. If no realistic wrong change to the code would make it fail, delete it.
- The right answer comes from outside the code, such as a figure from the filed annual report. Never copy the code's current output into a test as the expected value.
- Each rule in this plan gets one test, such as a 53-week year counting as a full fiscal year, the latest restated number winning, a products-only tag being ignored, or a gap never becoming zero. New tests come from bugs found: each bug gets one test that reproduces it.
- Test what goes in and what comes out, not how the code is built. Use a stand-in for the SEC only, never for the project's own code.
- Do not test what TypeScript, Effect's schema tool or the libraries already guarantee.
- Now and then, break the code on purpose. If no test fails, the tests are hollow. If many fail for one mistake, they overlap and some should go.

---

## Part 1: Prove the pieces start together

Rests on: [Build on TypeScript, Effect, SQLite and TanStack Start, run on Bun](./docs/adr/0004-stack-run-on-bun.md).

### T01: A page that starts on Bun

**Depends on:** nothing. **Size:** medium.

- [x] Create the project with TanStack Start and React, built with Vite+, run by Bun.
- [x] `task init` installs everything. `task dev` serves one page on this machine.
- [x] `task check`, `task fix`, `task test`, `task build` and `task ci` are defined and pass on the empty project.
- [x] `task doctor` checks for Bun instead of Node and pnpm.

**If Vite+ will not start with Bun:** switch to plain Vite with Oxlint and Oxfmt, and add that to the decision record. Do not spend more than half a day on it.

**Check:** `task ci` passes from a fresh copy of the repository. The page opens in a browser.

### T02: Effect reads and writes SQLite

**Depends on:** T01. **Size:** small.

- [x] One Effect program opens a SQLite file through Effect's own database client and Bun's connector.
- [x] A first change to the database's structure runs through Effect's built-in tool for that.
- [x] The program writes one row and reads it back, with the row's shape described by Effect's schema tool.
- [x] A test covers it using Effect's helper for Vitest.
- [x] Effect's checking plugin for TypeScript is switched on, or noted as not working with this setup.

**Effect ideas:** an Effect as a description of work, running one, services and layers, the schema tool.

**Check:** the test passes. The database file is ignored by git.

### T03: A screen shows a value from the database

**Depends on:** T02. **Size:** small.

- [x] A function on the server runs an Effect program that reads SQLite and returns plain data.
- [x] The page calls it through TanStack Query and shows the value.
- [x] No Effect code appears in any screen file.

**Effect ideas:** turning an Effect into a plain promise at the edge.

**Check:** change the row in the database, reload, and the page shows the new value.

### Checkpoint A: the stack is proven

- [x] `task ci` passes.
- [x] The decision record says what was actually used, including any fallback.
- [x] Confirm that the SQLite inside Bun includes its text search, and note the answer in the stack RFC.

---

## Part 2: Numbers in the terminal

The goal of this part is one command, `task collect -- AAPL`, that prints where the money goes for every fiscal year. No screen yet. If the numbers are wrong here, no screen can fix them.

Rests on: [How filing data becomes glossary terms](./docs/rfc/0004-filing-data-to-glossary-terms.md), which holds what the SEC's data looks like for the three companies, and [How we know a number on screen is right](./docs/rfc/0006-trusting-the-numbers.md).

### T04: Ask the SEC for data, politely

**Depends on:** T02. **Size:** medium.

- [x] One service makes every request to the SEC. Nothing else talks to it.
- [x] It never sends more than ten requests per second, however many are waiting.
- [x] It tries again after a short wait when a request fails for a passing reason, and gives up with a clear reason when it does not.
- [x] It sends the contact details the SEC asks for, read from a local setting that is never committed. Without them it refuses to run and says why.

**Effect ideas:** the web request module, retry schedules, rate limiting, errors as named kinds.

**Check:** a test with a stand-in for the SEC shows the limit holds and the retries happen. One real request for Apple's numbers succeeds.

### T05: Know every company by name

**Depends on:** T04. **Size:** small.

- [x] Fetch the SEC's list of public companies and store name, ticker and company number.
- [x] Search by name or ticker returns matches, best first.
- [x] Every company starts as not collected.

**Check:** searching "cost" finds Costco. Searching "MSFT" finds Microsoft.

### T06: A place to keep reported numbers

**Depends on:** T02. **Size:** medium.

- [x] The database holds companies, filings and reported numbers.
- [x] A reported number keeps its value, its tag, the dates it covers, the filing it came from and the day that filing was published.
- [x] Two different values for the same fiscal year are both kept.

**Check:** a test stores an original and a restated number for one fiscal year and reads back both.

### T07: Store one company's numbers

**Depends on:** T04, T06. **Size:** medium.

- [x] Fetch all reported numbers for one company in a single request and check their shape with the schema tool.
- [x] Keep only numbers from annual reports (10-K) that cover a full fiscal year, and the balances at each year end.
- [x] A number in an unexpected shape is reported, not silently dropped.
- [x] A small script trims the SEC's data for Apple, Costco and Microsoft down to the tags the tests need, and the extracts are committed beside the tests.

**Effect ideas:** decoding outside data with the schema tool, doing database work in one transaction.

**Check:** after storing Apple, the database holds its reported numbers back to fiscal 2008.

### T08: Work out the fiscal year of each number

**Depends on:** T07. **Size:** small.

- [x] A number's fiscal year comes from the dates it covers, never from the SEC's own year label, which is the year of the filing.
- [x] Years of 52 and 53 weeks both count as full fiscal years.
- [x] A fiscal year is named by the calendar year it ends in.

**Check:** Apple's fiscal 2023 is the period ending 30 September 2023. Microsoft's is the year ending 30 June 2023. Costco's ends on 3 September 2023.

### T09: Turn tags into eight glossary terms

**Depends on:** T08. **Size:** medium.

- [x] For each of the eight terms, an ordered list of the tags that count is kept as data, not buried in code.
- [x] For each fiscal year the latest restated number is chosen, and the original stays available.
- [x] Tags that cover only part of a term, such as revenue from products only, are never used.
- [x] A company's tags that look related but are not on any list are reported, so the lists can grow.

**Check:** revenue is continuous with no missing or doubled fiscal year, from 2008 to 2026, for all three companies.

### T10: Calculated numbers and gaps

**Depends on:** T09. **Size:** small.

- [x] Gross profit is calculated from revenue and cost of revenue when the company does not report it, as with Costco.
- [x] Selling, general and administrative is added up from its two parts when the company reports them separately, as with Microsoft.
- [x] A term the company never reports, such as research and development at Costco, is a gap and never zero.
- [x] Every calculated number is marked as calculated and keeps the numbers it was made from.

**Check:** Costco has a calculated gross profit and a gap for research and development. Microsoft has a calculated selling, general and administrative.

### T11: Check the numbers, and print them

**Depends on:** T10. **Size:** medium.

- [x] Each fiscal year is checked: gross profit equals revenue minus cost of revenue, and operating income equals gross profit minus the operating expense lines, within a small rounding allowance. Since review, a gross profit that breaks its definition is set aside behind the calculated one, other operating expenses make every year add up, and operating income is checked against the totals the company reports. See [the decision](./docs/adr/0006-definitions-win-differences-are-shown.md).
- [x] A number that fails becomes a doubtful number and keeps the check it failed.
- [x] `task collect -- AAPL` collects one company and prints the eight terms for every fiscal year, with calculated, doubtful and gap marks.
- [x] A test holds Apple's fiscal 2023 to its filed values, in millions of dollars: revenue 383,285, cost of revenue 214,137, gross profit 169,148, research and development 29,915, selling general and administrative 24,932, other operating expenses 0, operating income 114,301, net income 96,995.

**Effect ideas:** the command line module.

**Check:** run the command for Apple, Costco and Microsoft. Compare one recent fiscal year of each against its annual report by hand. Costco's fiscal 2023 should show revenue 242,290 and cost of revenue 212,586.

### Checkpoint B: the numbers are right in the terminal

- [x] Three companies print, and one fiscal year of each has been confirmed by hand.
- [x] Every doubtful number has been looked at: is the data wrong, or the check?
- [x] What was learned about tags is written back into the RFC.
- [x] Review together before any screen work starts. Settled by [the decision on definitions and differences](./docs/adr/0006-definitions-win-differences-are-shown.md).

---

## Part 3: Collecting on demand

Rests on: [Collect companies on demand, with no fixed list](./docs/adr/0002-collect-companies-on-demand.md) and [The first version covers annual report (10-K) filers outside finance and property](./docs/adr/0003-first-version-covers-10-k-filers-outside-finance.md).

### T12: A company moves through its states

**Depends on:** T11. **Size:** medium.

- [x] A company is not collected, waiting, collecting, ready or failed, and the state is stored.
- [x] Asking for a company puts it in line. Companies are collected one after another in the background and share the SEC's limit.
- [x] A failed company keeps its reason and can be tried again.
- [x] A ready company has its as of date and its last checked date.

**Effect ideas:** queues, work that runs in the background, scopes that clean up after themselves.

**Check:** ask for three companies at once. All three become ready, in order, without breaking the limit.

### T13: Pick up after being closed, and remove

**Depends on:** T12. **Size:** small.

- [x] If the tool stops while a company is waiting or collecting, that company continues the next time the tool starts.
- [x] Removing a company deletes its collected data and returns it to not collected. A company that is waiting or collecting cannot be removed until it is ready or has failed.

**Check:** stop the tool in the middle of a collection and start it again. The company becomes ready.

### T14: Decline what is not covered

**Depends on:** T05. **Size:** small.

- [x] Before collecting, the tool looks at the industry code the SEC gives the company and at which yearly form it files.
- [x] Banks, insurers, property trusts and companies that do not file an annual report (10-K) are answered as not covered, with the reason, and nothing is collected.

**Check:** JPMorgan and Toyota are declined, each with its own reason. Costco is accepted.

---

## Part 4: The slice's screen

Rests on: [What the prototype should look and feel like](./docs/rfc/0001-prototype-look-and-feel.md) and [Which screens the first version needs](./docs/rfc/0002-first-version-site-structure.md).

T15 and T17 do not depend on Parts 2 and 3 and can be done alongside them.

### T15: The foundations of the look

**Depends on:** T01. **Size:** medium.

- [x] Colours, type sizes, spacing and hairlines are defined once, as named values, with Tailwind.
- [x] The surface is near black. Text is white for main figures and greys for the rest, with readable type and strong contrast.
- [x] The typeface has digits of equal width, and its licence allows sharing.
- [x] A bare page layout exists with the floating bar at the bottom.

**Check:** a sample page with a column of numbers lines up digit under digit. Text contrast passes a standard readability check.

### T16: The Companies screen, enough for the slice

**Depends on:** T05, T12, T14, T15. **Size:** medium.

- [x] Search covers every public company and shows each one's state.
- [x] Choosing a company that is not collected says what will happen and asks first. The first time, it also asks for the contact details the SEC requires.
- [x] A company being collected shows progress. A quiet notice appears when it is ready, and the current screen stays in place.
- [x] Ready companies are listed with their as of date.
- [x] Ready companies sit side by side in a table that sorts, with ten fiscal years of revenue and operating margin, and become cards when the table does not fit.

**Check:** from an empty database, search for Costco, agree, and watch it become ready without leaving the screen.

### T17: Try two forms of the money flow

**Depends on:** T15. **Size:** small. **Needs a decision from you.**

- [x] Two quick throwaway drawings with Apple's real fiscal 2023 figures: a flow diagram where revenue splits into streams, and stacked bars with one bar per fiscal year.
- [x] Look at both, for one fiscal year and across ten.
- [x] Pick one, write the choice and the reason into the look and feel RFC, and delete both throwaways.

**Check:** the choice is written down.

### T18: Where the money goes

**Depends on:** T11, T16, T17. **Size:** medium.

- [x] The chosen drawing shows the eight terms for one fiscal year, each as dollars and as a share of revenue.
- [x] A control moves through the fiscal years. The chosen year lives in the address bar, so reloading or going back keeps it.
- [x] Calculated numbers, doubtful numbers and gaps each have their own quiet mark.
- [x] Every number can show which filing it came from, with a link to it.

**Check:** Apple, Costco and Microsoft each open and match what `task collect` printed. Costco shows a gap for research and development.

### T19: The term card

**Depends on:** T18. **Size:** medium.

- [x] The glossary file is read into terms, each with its definition, example and words to avoid. It stays the only source.
- [x] Every term on the screen can be clicked, and opens a card with its definition and example.
- [x] Where the term maps to a number, the card also shows this company's own figure for the chosen fiscal year.
- [x] The card opens and closes with the keyboard.

**Check:** on Costco, click "gross profit". The card explains the term, shows Costco's figure, and says it is calculated.

### T20: Finish the screen

**Depends on:** T19. **Size:** medium.

- [x] Movement: values roll when the fiscal year changes, and the drawing moves from one year to the next instead of jumping.
- [x] Every state has a designed screen: not collected, waiting, collecting, failed, and not covered.
- [x] The whole slice works with the keyboard alone.
- [x] Playwright saves a picture of the screen for each of the three companies, built from the committed extracts, and `task ci` compares against them. `task screens:update` saves new ones after a change has been looked at.

**Check:** someone who has not seen it uses it for ten minutes with no help.

### Checkpoint C: the first slice is done

- [ ] Search, collect, and "Where the money goes" work for Apple, Costco and Microsoft from an empty database.
- [ ] You can answer "where does each dollar of revenue go?" for each of the three after a few minutes.
- [x] What was learned is written into the RFCs. Anything hard to change later has a decision record.
- [ ] Part 5 is broken down in full, using what the slice taught.
- [ ] Review together before going on.

---

## Part 5: The rest of the first version

Coarse on purpose. Each task is broken down when it is reached.

### T21: All three statements as glossary terms

**Depends on:** Checkpoint C.

- [x] Extend the tag lists from eight terms to every reported term in the glossary's income statement, balance sheet and cash flow statement groups.
- [x] Add the checks for the other statements, starting with assets equal liabilities plus equity.
- [x] Adjust share counts and earnings per share for share splits.
- [x] Add the calculated terms: free cash flow, net debt, the margins.

### T22: The Statements screen

**Depends on:** T21.

- [x] Three tabs, fiscal years as columns, calculated lines in grey under the line they come from, the newest fiscal year tinted.
- [x] Every number links to its filing, and every term opens its card.

### T23: The Overview screen

**Depends on:** T21.

- [x] Revenue and net income across the fiscal years as the main chart.
- [x] A strip of key figures for the latest fiscal year.
- [x] The opening of the company's own description of its business, quoted from its annual report (10-K), with a link.
- [x] One dollar of revenue split into its parts under the headline, opening Where the money goes.
- [x] What the company did with its cash: free cash flow against net income, and what it spent on, with three links to look further.

### T23b: What the Overview still lacks

From the review by a financial adviser, a product manager and a designer on 11 November 2026.

- [ ] Collect short-term investments, so cash and net debt count everything a company can turn into money quickly. Until then the Overview shows neither, because Apple and Microsoft would look as if they owe more than they hold.
- [ ] Mark a year whose net income was moved by a one-off item, such as Tesla's tax gain or Microsoft's charge under the 2017 US tax law, so a beginner does not read it as the business changing.
- [ ] Collect the share count, and show whether it shrank through share buybacks or grew through dilution.
- [ ] Work out return on invested capital from operating income, tax, debt and equity.
- [ ] Say what the company sells: its industry from the SEC, and the revenue lines on its own income statement, such as Apple's products and services or Costco's membership fees.
- [ ] Decide whether the fiscal year ruler on the Overview can shrink to a label with a picker.

### T24: What the company did with its money

**Depends on:** T21.

- [x] Capital allocation per fiscal year from the cash flow statement: acquisitions, share buybacks, dividends, capital expenditure, debt raised and repaid.

### T25: Two kinds of corporate event

**Depends on:** T07.

- [x] From current reports (8-K), keep only those the SEC labels as a change of chief executive or finance chief, or as a completed acquisition or sale of a business.

### T26: Economic context

**Depends on:** T04.

- [x] Collect interest rate, inflation and recession periods from the US central bank's public data.
- [x] Confirm its terms allow each person to fetch it this way, and note the source. FRED, public domain, named on the timeline. See the site structure RFC.

### T27: The Timeline screen

**Depends on:** T24, T25, T26.

- [x] One time axis with stacked rows: revenue and net income, capital allocation, corporate events, economic context.
- [x] Choosing a point in time shows everything that was true then.

### T28: The Glossary page

**Depends on:** T19.

- [x] Every term, in learning order, on one browsable page.

### T29: Renamed and reorganised companies

**Depends on:** T12.

- [ ] A renamed company shows as one history, with its earlier names.
- [ ] A reorganised company shows a note linking it to the company it came from.

### T30: Check for new filings

**Depends on:** T12.

- [x] Ready companies are checked for filings newer than their as of date, monthly and weekly around their annual report, behind anything asked for. New ones are collected and last checked moves on.
- [ ] A button to check one company now, shown first as a mock.

### Checkpoint D: the first version is done

- [ ] Take the done test yourself on a company you have not looked at: five questions, 30 minutes.
- [ ] Have one person who is new to the field take it.
- [ ] Write what failed into the RFC on teaching, and decide what to fix before going on.

---

## Part 6: Before publishing

### T31: Make it runnable by someone else

- [ ] The README says how to install and start it from nothing.
- [ ] A fresh copy on another machine reaches a ready company by following the README alone.

### T32: Licence and housekeeping

- [ ] Add the MIT licence file.
- [ ] Confirm the licence of everything installed, and of the typeface and icons.
- [ ] Decide which email address appears on the commits before the history becomes public.
- [ ] Add a short guide for contributors and for coding agents: the glossary rule, the rules for tests, RFCs and decision records, the task names, the commit format.

### T33: Checks that run by themselves

- [ ] `task ci` runs on every proposed change once the repository is hosted.

---

## Parked

Not part of the first version. Each needs its own RFC before any work starts.

- The agent. See [An agent that does not invent numbers](./docs/rfc/0007-an-agent-that-does-not-invent.md).
- Quarters.
- Share prices, market capitalization, market context, event studies and valuation. Blocked on a data source anyone may use.
- Industry context and comparing companies.
- Segments.
- Banks, insurers, property trusts, and companies that do not file an annual report (10-K).
- History before the first machine-readable annual reports, which reach back to about fiscal 2007.
- Your own notes on a company, and progress across the 100. See [How we know the tool teaches](./docs/rfc/0008-knowing-the-tool-teaches.md).
