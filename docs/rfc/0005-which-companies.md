---
status: closed
opened: 2026-11-11
closed: 2026-11-11
---

# Which companies are covered, and how they get in

## Question

Should the tool start with a fixed list of companies, or collect a company only when someone asks for it? And which kinds of company does it leave out because their finances do not fit the glossary?

## Why it matters

A fixed list has to be chosen, collected up front and kept current, and it will always be missing the company someone wants. Collecting on demand removes that choice, but it means the tool must handle a company that is not there yet, one that is half collected, and one that cannot be collected well.

Separately, the glossary and the screens assume a company that sells something, pays to make it, and keeps the rest. Several large groups of companies do not work that way.

## What we know

**About collecting on demand**

- The SEC publishes one small list of every public company with its name and ticker. With that list stored, search can find any company before any of its data is collected.
- All of a company's reported numbers come back from the SEC in a single request, and its list of filings in one or two more. The numbers for one company can be ready in seconds.
- The text of the filings, which the agent reads, is many more requests and takes longer.
- The SEC's limit of ten requests per second applies to the whole tool, so several companies being collected at once must share it.
- The project is planned as open source and never ships collected data. Every person starts with an empty database, so some form of collecting on demand is needed in any case.

**About companies that fit poorly**

- Banks and insurers have no cost of revenue and no gross profit. A bank's main income is the gap between the interest it earns and the interest it pays, and its balance sheet is its business.
- Property trusts and utilities are judged with their own measures, which the glossary does not hold.
- Many foreign companies listed in the United States do not file an annual report (10-K). They file a different form, often under different accounting rules.
- Companies change over time: they rename themselves, merge, split in two, or move their fiscal year end. Facebook became Meta, and Google became Alphabet.
- A young company has only a few fiscal years of filings, so a ten-year view is partly empty.

## Options

### Recommended: collect on demand, with no fixed list

Proposed on 11 November 2026.

1. Search covers every public company from the SEC's list, whether collected or not.
2. Choosing a company that is not collected shows what would happen and asks before doing it. Asking matters because collecting sends requests to the SEC under the person's own contact details.
3. Saying yes starts the collecting in the background. The person can keep using the tool.
4. The company moves through clear states, each visible wherever the company appears:

| State         | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| Not collected | Known by name and ticker only.                                     |
| Waiting       | Asked for, and in line behind others.                              |
| Collecting    | Being fetched and checked now, with progress shown.                |
| Ready         | Its numbers are in and passed their checks. It can be opened.      |
| Failed        | Collecting stopped. The reason is shown and it can be tried again. |

5. A ready company shows two dates: the date of the newest filing it includes, and the day the SEC was last checked for newer ones. Together they say how current it is and make "check for new filings" a simple action.
6. The numbers arrive first and make the company ready. The filing text for the agent keeps arriving afterwards, and the agent says so until it is complete.
7. A company that fits poorly is flagged before collecting starts, not after.

The goal of understanding 100 companies stays, as a learning goal. It stops being a limit on the data.

A starter list of suggested companies can still be shipped, as names only, for someone who does not know where to begin.

### Alternative: a fixed list collected up front

One command collects a chosen 100 before first use. Simpler screens, because every company is always ready. Rejected as the main path because the list is never the right one for the next person, and first use would begin with a long wait.

## Outcome

Closed on 11 November 2026. Collecting on demand is the choice, and the first version's limits are set.

**Decided**

- There is no fixed list. Search covers every public company, and a company is collected only when asked for and agreed to.
- The state of a company that can be opened is called ready.
- A ready company shows two dates: as of, the date of the newest filing included, and last checked, the day the SEC was last asked for newer filings.
- When a company becomes ready, a quiet notice appears. The screen being read stays in place.
- Several companies can be asked for at once. They wait in line and share the SEC's request limit.
- Banks, insurers and property trusts are declined with a reason. They are not collected.
- Only companies that file an annual report (10-K) are covered.
- A renamed company is one continuous history. A reorganised one appears as two companies with a note linking them.
- A collected company can be removed, which deletes its data and returns it to not collected.

The new words are in the glossary under "Collecting a company".

**Recorded as decisions**

- [Collect companies on demand, with no fixed list](../adr/0002-collect-companies-on-demand.md)
- [The first version covers annual report (10-K) filers outside finance and property](../adr/0003-first-version-covers-10-k-filers-outside-finance.md)

**Left to settle while building**

- If the tool is closed while a company is collecting, it should pick up where it left off. How is not yet worked out.
- Whether to ship a starter list of suggested companies, as names only.
- How the tool recognises a bank, an insurer or a property trust before collecting. The SEC gives every company an industry code, which is the likely answer.
