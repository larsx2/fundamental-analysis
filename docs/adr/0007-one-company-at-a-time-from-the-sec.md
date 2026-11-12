---
status: accepted
date: 2026-11-11
---

# Companies come from the SEC one at a time, and stay current the same way

The tool downloads each company from the SEC by itself: its list of filings, and the SEC's summary of every number it has reported. It does not use the SEC's nightly files that hold every company at once. A ready company is checked for new filings once a month, and every week from the end of its fiscal year until its annual report is due. What the person asked for always goes first.

We chose this because a person follows tens of companies, not thousands, so downloading gigabytes every night to their machine would be waste, and because the per-company downloads reflect a new filing within a minute. A check is one request, and only a new annual report brings a second one for its numbers.

The SEC's summary leaves out breakdowns, such as revenue by product or by region, and numbers a company tags under its own names. No screen needs those yet. When one does, the data will come from each filing itself, which never changes once filed and so is downloaded once.

## Consequences

- Corrected annual reports (10-K/A) and transition reports (10-KT) are kept like any annual report. Where a number appears in more than one, the latest filed is shown, and the first is kept beside it.
- A check that fails stores nothing and changes no date, so it finds the same filings new the next time.
- Comparing companies across the whole market would need the nightly files. That would be a different product and needs its own RFC.
