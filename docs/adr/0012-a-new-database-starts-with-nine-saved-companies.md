---
status: accepted
date: 2026-11-16
---

# A new database starts with nine saved companies

The repo holds the SEC's answers for nine companies, in `starter/sec-answers.json.gz`. They are the five drawn on the home page and the others the evals ask about: Apple, Microsoft, Costco, Tesla, NVIDIA, Cloudflare, Intel, Alphabet and Salesforce. The answers include the SEC's list of all companies. When `bun run dev` finds no database, it builds one from these answers, with the same steps the tool uses to collect a company, before the tool starts. Nothing reaches the SEC.

We chose this because up to ten agents work at once, each in a worktree of its own whose database starts empty. Without it, each would collect the same companies from the SEC before doing anything, and together they could break the SEC's limit of ten requests per second for this computer. It also gives a new person a full home page before they give any contact details, and gives every worktree the same annual reports the evals' answer key was written from.

This changes [Collect companies on demand, with no fixed list](0002-collect-companies-on-demand.md), which said the project ships no data. The SEC's [webmaster FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions) describes EDGAR public filing content as free to access and reuse. The snapshot retains its collection date and source URLs; it is SEC source material, not project-authored code under the MIT licence. Every other company is still collected only when asked for.

## Consequences

- A database is never rebuilt or changed once it exists, so the owner's own data is never touched.
- Logos come from Wikidata, so they are not saved. The tool fetches them when it starts.
- The saved companies are as of the day they were saved. Once a contact is given, the tool checks them for new filings on its usual schedule, like any company it collected. A newer annual report found that way replaces the one the evals' answer key was written from.
- The owner refreshes the answers with `task starter:record`, which asks the SEC again. A refresh can bring a newer annual report, after which the evals' answer key must be checked against it.
- The file is about 5 MB, and each refresh adds that much to the repo's history.
