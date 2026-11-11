---
status: accepted
date: 2026-11-11
---

# Collect companies on demand, with no fixed list

The tool holds no fixed set of companies. Search covers every public company from the SEC's list, and a company's data is collected only when a person asks for it and agrees. We chose this because the project ships no data, so every person starts empty anyway, because any fixed list is the wrong one for the next person, and because collecting sends requests to the SEC under that person's own contact details, which they should agree to each time.

Understanding 100 companies remains the learning goal. It is not a limit on the data.

## Consequences

- Every place a company appears must handle five states: not collected, waiting, collecting, ready and failed.
- Collecting runs in the background, several companies can wait in line, and all of them share the SEC's limit of ten requests per second.
- A ready company carries two dates: as of, and last checked.
- A person can remove a company, which returns it to not collected.

Explored in [Which companies are covered, and how they get in](../rfc/0005-which-companies.md).
