---
status: exploring
opened: 2026-11-11
closed:
---

# How filing data becomes glossary terms

## Question

How does a number in a company's filing become one of the glossary's terms for one fiscal year, reliably, across public companies that each label things in their own way?

## Why it matters

Every screen shows glossary terms, and every filing uses the company's own labels. If this step is wrong, every chart is wrong while still looking right. It is the core of the tool and no library does it.

## What we know

- The same term appears under different official tags from company to company, and a company can change the tag it uses from one year to the next.
- A company often publishes the same fiscal year's number more than once. A later annual report can restate an earlier year, and the two values differ.
- Old filings are not adjusted for later share splits. Apple's 2013 share count has to be multiplied by 28 to compare with today's.
- Some glossary terms are not reported as a single number and have to be calculated, such as free cash flow and net debt.
- Some companies do not report a line the glossary expects at all.

**What the SEC's data shows for the three slice companies, read on 11 November 2026**

Taken from the SEC's public numbers for Apple, Costco and Microsoft, looking only at the seven terms the money flow screen needs.

| Term                                | Apple                                                 | Costco                                       | Microsoft                                                                                                                |
| ----------------------------------- | ----------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Revenue                             | Three different tags over the years, changing in 2017 | Three tags                                   | Four tags, one of which covers products only and must be ignored                                                         |
| Cost of revenue                     | One tag throughout                                    | Two tags, changing in 2016                   | Three tags, one of them products only                                                                                    |
| Gross profit                        | Reported                                              | Not reported, so it must be calculated       | Reported                                                                                                                 |
| Research and development            | Reported                                              | Not reported at all, so it is a gap          | Reported                                                                                                                 |
| Selling, general and administrative | Reported as one line                                  | Reported as one line                         | Never reported as one line. Selling and marketing, and general and administrative, are separate lines that must be added |
| Operating income                    | One tag                                               | One tag                                      | One tag                                                                                                                  |
| Net income                          | One tag                                               | Two tags that mean slightly different things | One tag                                                                                                                  |

- All three have fiscal years with more than one published value: two for Apple, four for Costco, and four for Microsoft.
- The data reaches back to fiscal 2008 for all three, because the first machine-readable filings also carried the two years before them.
- Where a company moved from one tag to another, the years around the change appear under both tags.
- Each number in the SEC's data carries a fiscal year label, but that label is the year of the filing it appeared in, not the year the number is about. A fiscal year has to be worked out from the dates the number covers.
- The SEC's data service answered requests that carried a plain program name and no contact details. The SEC's rules still ask for contact details, and its main site refused requests without them.

**What collecting the three companies taught, on 11 November 2026**

The seven terms now come from ordered tag lists in [`src/server/terms/term-tags.ts`](../../src/server/terms/term-tags.ts). What shaped them:

- A restatement can arrive under a newer tag. Microsoft's fiscal 2016 revenue is 85,320 million under `SalesRevenueNet`, as first filed, and 91,154 million under `RevenueFromContractWithCustomerExcludingAssessedTax`, restated two years later for a new accounting rule. So the newer tag comes first on each list.
- A tag means only what each company files under it. `SalesRevenueNet` is all of Apple's revenue but only Costco's net sales, without membership fees. `CostOfGoodsSold` is all of Costco's cost of revenue but only Microsoft's products. Both sit last on their lists, where these companies never reach them, and the checks catch any company that does.
- Costco reports gross profit once, for fiscal 2019, and that figure is gross margin on net sales only: 16,465 million against 19,817 million worked out from revenue and cost of revenue. The check marks it as a doubtful number.
- Microsoft's operating income includes impairment, integration and restructuring lines in fiscal 2012 and 2014 to 2017, so operating income minus research and development and selling, general and administrative does not add up in those years. Microsoft's reported total operating expenses explain 2012, 2014 and 2015 exactly, and it reports no total for 2016 and 2017. These are doubtful numbers where the data is right and the check is too narrow.
- Microsoft never reports selling, general and administrative as one line. It is calculated from selling and marketing plus general and administrative in every fiscal year.
- Apple's revenue reaches back to fiscal 2007, because its first machine-readable annual reports carried three years of income statements. Balances at year ends reach back further still.
- Collecting one company is one request of about four megabytes and takes about a second. It yields 8,000 to 10,000 reported numbers from annual reports.

## Options

### Settled on 11 November 2026

- **Restated numbers.** When a fiscal year has more than one published value, screens show the latest restated one by default, so that years compare fairly. Every published value is kept with the filing it came from, and the original can be seen on request.
- **History starts around 2009.** That is when filings began to be published in a form a program can read. Earlier fiscal years are not collected.
- **Missing terms.** A term the company does not report shows as a gap with a short note. A term that can be worked out exactly from others, such as gross profit from revenue and cost of revenue, is shown and marked as a calculated number.

## Open points

- For each glossary term, which tags count, and in what order of preference? Answered for the seven terms of the money flow, above. The other terms follow in the statements work.
- Should the operating income check subtract the company's reported total operating expenses when it reports one? That clears Microsoft's 2012, 2014 and 2015, and leaves 2016 and 2017 doubtful.
- History is settled as starting around 2009, but fiscal 2007 and 2008 arrive with the first filings. Are they shown, or cut?
- How are share counts and earnings per share adjusted for share splits?
- What happens when a company uses a tag that is not yet mapped? Answered: related tags on no list are reported by `task collect`.
- Can each mapped number carry where it came from, so any figure on screen links back to its filing? Answered: every reported figure keeps its tag, filing and publication date, for the latest and the original value.

## Outcome
