---
status: closed
opened: 2026-11-13
closed: 2026-11-13
---

# Searching the text of annual reports

## Question

Would the agent gain from keeping the text of each annual report on the reader's computer and searching it, and if so, what kind of search?

## Why it matters

Four of [the twenty questions](./0009-the-twenty-questions-the-agent-answers-first.md) cannot be answered today because they need the company's own words: who it competes with, its main risks, what it says about its year, and part of what it does. These are the questions investors rank second after the statements themselves. Without the text, the agent can only say it cannot answer them.

## What we know

- **Figures do not need text search.** Each figure already comes from a lookup over reported numbers, with every change worked out. Searching the text for figures would bring back numbers the screen cannot check, which [An agent that does not invent numbers](./0007-an-agent-that-does-not-invent.md) rules out.
- **The tool already downloads the latest annual report and throws its text away.** Collecting a company fetches its latest annual report (10-K) to read the opening of its business description, then keeps three sentences (`src/server/collect.ts`, `businessDescription`). Keeping the rest costs no extra request to the SEC.
- **A report is about 31,000 to 60,000 words, or 42,000 to 80,000 tokens.** That is 3 to 6 times the 14,000 tokens a question uses today. The latest reports were measured on 13 November 2026:

  | Company   | Words  | Business (Item 1) | Risk factors (Item 1A) | Management's discussion (Item 7) |
  | --------- | ------ | ----------------- | ---------------------- | -------------------------------- |
  | Apple     | 34,500 | 2,975             | 12,332                 | 2,712                            |
  | Costco    | 31,509 | 2,961             | 6,450                  | not found                        |
  | Tesla     | 59,834 | 6,549             | 12,650                 | 8,436                            |
  | Microsoft | 48,184 | not found         | not found              | not found                        |

- **Splitting a report into its items by their headings is unreliable.** It worked for Apple and Tesla. Costco's management's discussion has no "Item 7" heading in its body, only in the table of contents. Microsoft repeats "PART I, Item 1" at the top of every page, so the real headings cannot be told from the page headers.
- **SQLite's full-text search is already in Bun and is fast enough.** The four reports split into 2,074 paragraphs of 12 words or more. Indexing them took 53 ms, and each search took under 1 ms. Searches found the right passages:
  - Costco's "competitor OR competition" returned "The retail business is highly competitive…".
  - Tesla's "tariff" returned its passage on retaliatory tariffs.
  - Microsoft's "artificial intelligence risk" returned its passage on the cost of building AI models.

  The test used `fts5` with the `porter unicode61` tokenizer, Bun 1.4.0.

- **Search by meaning ("embeddings") would need a model on the reader's computer.** The reader's ChatGPT plan through Codex offers no embeddings, and a key is ruled out. [qmd](https://github.com/tobi/qmd), a local search tool with an MCP server, was read on 13 November 2026. Its search by meaning runs three local models:
  - a 300 MB embedding model;
  - a 640 MB reranker;
  - a 1.1 GB model that rewrites queries.

  The models run through `node-llama-cpp`, which needs native builds for each platform. On macOS, qmd also replaces Bun's SQLite with Homebrew's so that `sqlite-vec` can load.

- **The agent is a better query writer than those models.** Codex can run several keyword searches in one turn and judge what it gets back. qmd's own design skips query rewriting when a keyword search already scores strongly.
- **qmd has three ideas worth taking, about 60 lines in all:**
  - its query builder (`buildFTS5Query`), which keeps quotes and dashes in a question from breaking the search syntax;
  - its pair of tools: a search that returns hits anchored to line numbers, then a read of exact lines around a hit;
  - its advice to the model on writing keyword queries.

  The rest does not fit. It indexes whole files as one row, while here one row per paragraph is needed. It breaks text at Markdown headings, and annual reports are HTML.

## Options

### Keyword search over paragraphs, with a read of exact lines (recommended)

Keep the text of each annual report as paragraphs in an SQLite full-text table. Each paragraph keeps its filing, its line range and, where a heading was found, its item. Add two lookups:

- `search_report(ticker, words, item?)` returns the best paragraphs, each with its line range;
- `read_report(filing, from, count)` returns the exact lines.

The screen quotes only text a lookup returned, links it to the filing, and marks any quote that does not match, as it does with numbers.

- **Gives:** answers to the four text questions, with quotes the screen can check. The search does not depend on splitting the report into items correctly, so Microsoft's layout does not break it. It adds nothing to install, and the latest report needs no extra request to the SEC.
- **Costs:** about 150 to 250 lines and a migration. Each question that reads text adds a few thousand tokens to the reader's plan. The text takes about 250 KB per report on disk.
- **Rules out:** nothing. Search by meaning can be added later if keyword search misses.

### Search by meaning, as in qmd

- **Gives:** finds passages that use other words than the question, such as "rivals" for "competitors".
- **Costs:** 300 MB to 2 GB of models downloaded on first use, native builds for each platform, a replacement for Bun's SQLite on macOS, and time on every search. The agent already covers most of the gain by searching for several words itself.
- **Rules out:** the tool staying a plain install.

### Give the agent whole items, with no search

- **Gives:** the simplest code. A question about risks gets the whole risk section.
- **Costs:** up to 17,000 extra tokens per question for risks alone, more than the whole question costs today. It also depends on splitting the report into items, which failed for two of four companies.
- **Rules out:** nothing, but it fails exactly where the layout is unusual.

### Keep text out

- **Gives:** nothing to build.
- **Costs:** four of the twenty questions stay unanswered, including the risks, which investors rank second.

## How to tell whether it works

Today the agent answers none of the text questions, so the gain is counted from zero: how many it answers with words that are really in the report. Three tests, cheapest first.

### A pilot, to set the pass marks

On 13 November 2026, eight questions were searched in the four reports, once with the reader's own words and once with keyword queries rewritten the way the agent would. The top five results were read by eye, with no marked answers, so this is a rough guide and not a result.

- **The reader's own words fail where the report uses other words.** "Rivals" found nothing in all four reports. "What could go wrong" found nothing useful in any.
- **Rewritten queries fix that.** Competitors, dependence on suppliers and why sales changed each found a fitting passage in all four reports.
- **A broad question does not suit search.** "What are the main risks?" returned scattered paragraphs, not the list of risks, in all four reports.
- **Sometimes the report does not say.** Apple's report never says what its competitive advantage is, only that losing it would hurt. The right answer there is that the report does not say.

### Test 1: does search find the passage? No model, no cost

- **Marked answers.** For 4 reports (Apple, Costco, Microsoft, Tesla) and 8 topics, a person reads the report and marks the passages that answer, or marks that the report does not say. That is 32 marks. Each mark is kept as the passage's opening words, not a line number, so a change to how lines are cut does not break it.
- **The 8 topics.** The four from the twenty questions: what it does, who it competes with and its advantage, its main risks, what it says about its year. Four that readers ask in particular: its suppliers, its customers, why sales changed, and one topic of the company's own, such as tariffs for Tesla.
- **Two wordings each.** Every topic is asked once in the report's words and once in a beginner's, such as "rivals" for "competitors". That is 64 searches.
- **Saved queries.** The agent writes the keyword queries once and they are saved, so the test repeats exactly and uses none of the reader's plan.
- **Pass marks.**
  - A marked passage is in the top 8 results for at least 58 of the 64 searches (90%).
  - The beginner's wordings score no more than 10 points below the report's wordings. This gap is the most that search by meaning could add, so it settles that option without building it.
  - The list of risk headings holds at least 95% of the headings a person counts in each report.
- **Every miss is read and sorted:** other words (search by meaning would fix it), the way the page was cut into paragraphs (it would not), or a question too broad for search.

It runs in milliseconds on paragraphs kept beside the test, so it can run with every change.

### Test 2: does the agent answer right? Uses the reader's plan

The 32 topics in a beginner's words, plus 8 questions the reports do not answer: 40 questions, about 7 minutes and about 1 million tokens a run. It is run by hand after a change to the lookups or the instructions, and three times before deciding, to see how much answers vary.

| Check                                                                | Pass mark    | Why this mark                                |
| -------------------------------------------------------------------- | ------------ | -------------------------------------------- |
| Every quote matches the report word for word                         | 100%         | It is the tool's promise, as with figures    |
| At least one quote comes from a marked passage                       | 29 of 32     | One miss in ten can be found by asking again |
| A question the report does not answer gets "the report does not say" | 8 of 8       | Inventing an answer is the worst failure     |
| A number in the answer that no lookup gave                           | none         | The existing rule                            |
| The agent's own judgement, such as "a strong advantage"              | none, by eye | Read once by a person                        |

### Test 3: what does it cost the reader?

- **Time.** At most two trips to the model for the typical question: one that searches, one that writes. At the measured 4 seconds a trip, that is about 9 seconds. No question takes more than three trips.
- **Plan.** No more tokens than a figures question that needs a fresh lookup, plus 5,000 for the passages. That stays under the 17,000 extra that a whole risk section would cost.
- **No harm to figures questions.** "Where does Costco Wholesale's money go?" stays at about 5 seconds and 14,000 tokens with the two new lookups in the instructions.

### What the numbers can and cannot show

With 32 to 64 cases, one case is 2 to 3 points. That tells "works" (90%) from "does not" (70%), which is the decision here. It cannot tell 90% from 95%; that would need over 200 marked answers and is not worth the reading.

### What each result would mean

- **All three pass:** build keyword search.
- **Beginner's wordings miss more than 10 points, for "other words":** try search by meaning on the same 64 searches.
- **Quotes do not match word for word:** stop letting the model type quotes. It names the lines, and the screen prints them, as it does with figures.
- **Broad questions miss:** they go to a list, such as the risk headings, not to search.

## Results, 13 November 2026

All three tests were run on the latest annual reports of Apple, Costco, Microsoft and Tesla, with Codex 0.167.2 on a ChatGPT plan. The text lookups ran beside the tool's own lookups through a stand-in server, so the tool itself was not changed. The scripts and every answer are kept outside the repository.

### How the answers were marked

- Before any search was run, the passages that answer each topic were marked by reading each report's business section, risk factors and management's discussion.
- Each report's risk headings were counted by reading. The count agreed exactly with the headings set in bold or italics: 28 for Apple, 26 for Costco, 26 for Microsoft and 40 for Tesla.
- For the eight unanswerable questions, each report was searched to confirm it does not give the answer. Examples: iPhones sold, Costco's CEO pay, Xbox consoles sold.
- Reading the agent's answers showed that four answers quoted passages that should have been marked, such as Tesla's segment description repeated in the notes. Results are given both on the original marks and with those passages added.

### Test 1: search alone

| Check                                               | Result                                                              | Mark             | Verdict     |
| --------------------------------------------------- | ------------------------------------------------------------------- | ---------------- | ----------- |
| A marked passage in the top 8, with Codex's queries | 55 of 64 (86%)                                                      | 58 (90%)         | Missed by 3 |
| Beginner's wordings against the report's            | Beginner 30 of 32, report 25 of 32                                  | Within 10 points | Passed      |
| The question's own words, with no rewriting         | 38 of 64 (59%); beginner's wordings 13 of 32                        | For comparison   | –           |
| Risk headings found, each report                    | Apple 27 of 28, Costco 26 of 26, Microsoft 25 of 26, Tesla 38 of 40 | 95% each         | Passed      |

- **Rewriting the question into report words is what matters, and Codex does it well.** With the question's own words, beginner's wordings found 13 of 32. Rewritten by Codex, they found 30 of 32, more than the report's own wordings. A gap the other way leaves nothing for search by meaning to add, so it is not worth building.
- **The 9 misses:**
  - two searches returned nothing (Costco's and Microsoft's suppliers), because the query demanded "single source", which those reports do not use;
  - three questions were too broad: Apple's risks, and Costco's and Microsoft's year;
  - two were Tesla's customers, whose report has no passage saying who they are;
  - two queries listed product names where the report says "smartphones, personal computers".

  In the live test the agent searched again after an empty result, which this test does not allow.

- **Risk headings need two methods.**
  - Apple, Costco and Tesla set each heading as its own line, and a rule on the text alone finds them.
  - Microsoft sets each heading in bold at the start of its paragraph, so the text rule found 2 of 26. A rule on the bold text found 25 of 26, after one fix made on seeing Microsoft's misses: its bold text stops before the full stop.
  - Using the text rule, and the bold rule when the text rule finds too few, passes in every report. It also lists 10 lines that are not headings out of 126.

### Test 2: the agent's answers

The 32 topics in a beginner's words and the 8 unanswerable questions, run three times: 120 answers.

| Check                                                  | Run 1    | Run 2    | Run 3    | Mark   | Verdict |
| ------------------------------------------------------ | -------- | -------- | -------- | ------ | ------- |
| Quotes that match the report word for word             | 57 of 57 | 65 of 65 | 59 of 59 | All    | Passed  |
| Quotes taken from a lookup's result                    | All      | All      | All      | All    | Passed  |
| A quote from a marked passage, original marks          | 25 of 32 | 28 of 32 | 28 of 32 | 29     | Missed  |
| The same, with the four passages added                 | 29 of 32 | 30 of 32 | 29 of 32 | 29     | Passed  |
| "The report does not say" when it does not             | 8 of 8   | 8 of 8   | 8 of 8   | 8 of 8 | Passed  |
| A number no lookup gave                                | None     | None     | None     | None   | Passed  |
| A judgement, such as "a strong advantage", read by eye | None     | None     | None     | None   | Passed  |

- **23 of 32 topics were right in all three runs, and one was wrong in all three.** That one is Apple's rivals: Apple's report names none, so the agent said so and quoted nothing, though it had read Apple's description of its competition.
- **Costco named its rivals in its own words.** Walmart, Target, Kroger and Amazon came from a quoted passage, not from memory.
- **The agent did not always search the report before saying it does not hold an answer.** In 6 of the 24 unanswerable questions it answered only that the tool does not collect the figure. The answer was still right, but it did not check.
- The scoring script flagged years followed by a comma, such as "2026,", as numbers no lookup gave. They are years, not figures, so none counts.

### Test 3: cost to the reader

| Check                                                                 | Result                                                                                    | Mark                            | Verdict |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------- | ------- |
| Trips to the model for a text question                                | Median 3; 4 or 5 in 17 of 96 answers                                                      | At most 2 typical, never over 3 | Failed  |
| Time for a text question                                              | Median 10.1 to 10.8 seconds, longest 18.5                                                 | About 9 seconds                 | Failed  |
| Input tokens for a text question                                      | Median about 51,000, of which about 47,000 cached; most 85,000                            | About 20,000                    | Failed  |
| "Where does Costco Wholesale's money go?" with the text lookups added | 1 trip, 4.6 to 6.6 seconds, 15,500 tokens; without them 4.5 to 7.2 seconds, 15,100 tokens | No worse                        | Passed  |

- **The usual path is search, then read, then answer: three trips.** Search results were cut at 150 words, so the agent read the paragraph again before quoting it.
- **Each trip re-sends the question and the figures read beforehand,** which is why input reaches 51,000. Most of it is cached, but how OpenAI counts cached input against a plan's limits is not published.

### Verdict

- **Keyword search over paragraphs works for answers.** Every quote was exact. Accuracy reached the mark once the passages missing from the marks were added. Beginner's wordings did no worse than the report's.
- **Search by meaning is not needed.** In this test, Codex's rewriting closed the gap it would close.
- **It is not ready on cost.** A text question takes three trips, about 10 seconds and about 51,000 input tokens. A figures question takes one trip, about 5 seconds and about 15,000 tokens.
- **Two changes should cut a trip, and should be tested before building:**
  - return whole paragraphs, so the agent does not need read_report to quote;
  - tell the agent to search and read in the same call to the exec tool, which runs code and can chain lookups.

  Then re-run Test 2 and Test 3 with the same 40 questions.

## Open points

- Should only the latest report be kept, or all ten years? "What did the company say about its year" across years needs the older ones: one extra request to the SEC per year.
- How does the screen check a quote? Matching the exact words against the lines a lookup returned would mirror how numbers are checked. Safer still, the model names the lines and the screen prints them, so the model never types a quote.
- Risk factors need a list of their headings as well as search: the pilot showed search does not answer "What are the main risks?". Most reports set each risk's heading as its own short line.
- Tables in Item 8 become lines of numbers. They should be left out of the index, since the figures come from the reported numbers.

## Outcome

Built on 13 November 2026 and recorded in [The agent searches the latest annual report, and shows the passage under its answer](../adr/0011-the-agent-searches-the-latest-annual-report.md).

The before and after were measured with the eval in `evals/`. It asks the twenty questions of [RFC 0009](./0009-the-twenty-questions-the-agent-answers-first.md) about five companies, plus questions the reports cannot answer, false premises, follow-ups and comparisons. Each answer is graded against a key written from the annual reports. Apple, Costco and Microsoft were used to tune the agent. NVIDIA and Cloudflare were held out and only judged it.

Before and after were graded with the same, corrected grader.

| Companies                  | Before (two runs) | After, then after the fixes below |
| -------------------------- | ----------------- | --------------------------------- |
| Tuning, 74 questions       | 63 and 62 right   | 72, then 74 right                 |
| Held out, 49 questions     | 35 and 34 right   | 40, then 47 right                 |
| Typical seconds, all       | 4.2               | 5.7 to 6.5                        |
| Typical seconds, text only | could not answer  | 8.2, at most 14                   |

The pass marks were set before the build:

| Mark                                                                        | Result                                             | Met |
| --------------------------------------------------------------------------- | -------------------------------------------------- | --- |
| On the tuning companies, the four text questions go from 0 to 9 of 12 right | 12 of 12                                           | Yes |
| No other question gets worse                                                | Only one that already failed one run in two before | Yes |
| Every quote matches the report word for word                                | A quote that does not match is never shown         | Yes |
| A text answer takes 7 seconds or less                                       | 8.2 typical                                        | No  |

What the eval found besides:

- **The grader itself was wrong about 1 answer in 10 at first.** Examples: it read "−$102 million" as positive, and it missed "did not shrink". Each was fixed after reading the answers. A second key, written from the reports by an agent that had not seen the first, agreed on every figure checked.
- **Numbers from the report's text were marked as not from a lookup on the Ask screen.** Fixed: an amount written in a returned paragraph now counts.
- **The agent once said NVIDIA's report names no rivals.** It names AMD, Intel, Huawei and others, in a list the search did not return.
- **Losses lost their sign.** Cloudflare's answers wrote "a loss of $102 million" instead of "−$102 million", so the screen marked the number. Fixed with a rule in the agent's instructions.
- **Gaps in the collected figures, found on the held-out companies:** NVIDIA's capital expenditure, which it reports under another line, and Cloudflare's $3.27 billion of convertible notes. Both lines are now read. Cloudflare's dividends, which it has never paid, still show as a gap, but the agent now searches the report when a figure is a gap and says so.
- **Costco's dividend answer said the total "has varied"** without saying why. With a rule to search the report when a total jumps, it now gives the dividend for each share and names the special dividend of fiscal 2024.
- **Still open:** NVIDIA's "what does it say about its year" quoted its cash flow instead of what drove revenue, and a "cannot answer" sometimes still adds an unrelated figure. Both the fixes and these were judged on the held-out companies, so a new held-out company should judge the next change.

### A second held-out set

NVIDIA and Cloudflare had shaped those fixes, so they joined the tuning set, and Alphabet, Intel and Salesforce were held out in their place. The agent had never seen them. Three more changes were then tried, each shaped on the tuning companies and judged on the new ones:

| Change                                                               | On the held-out companies                                    | Kept        |
| -------------------------------------------------------------------- | ------------------------------------------------------------ | ----------- |
| A "cannot answer" gives no figures                                   | Intel's GPU question went from right in 1 run of 2 to 2 of 2 | Yes         |
| Say a report names no rivals only after searching its lists of them  | No change: already right                                     | Yes         |
| For "what does it say about its year", search for what drove revenue | Intel went from 1 to 2 runs right, Salesforce from 2 to 0    | No, removed |

| Held-out companies, 73 questions | Before | After  |
| -------------------------------- | ------ | ------ |
| Right, two runs                  | 73, 69 | 71, 71 |

The difference is within what two runs of the same code differ by, so the changes neither helped nor hurt overall. The tuning set scored 123 of 123.

Each answer now reports its round trips to the model and its tokens. A text answer takes 2 trips, sometimes 3, and about 36,000 input tokens, most of them cached, in about 9 seconds. Two trips are the fewest a search allows: one to search, one to answer. Reaching the 7-second mark would need the report's passages read before the question is asked, as the usual figures already are.

Still open: Intel's "what does it say about its year" answers with job cuts and its AI efforts rather than what drove revenue, and its uses of cash leaves out that it bought back no shares.
