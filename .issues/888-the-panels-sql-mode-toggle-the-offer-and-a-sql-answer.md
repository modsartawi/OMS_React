---
status: open
spec: BackOffice .issues\3632-sql-mode-the-copilot-writes-and-runs-one-guarded-select-and-its-answer-can-be-saved-spec.md
blocked-by: BackOffice 3673, BackOffice 3674
---

# 888 — The panel's SQL mode toggle, the "Try in SQL mode" offer, and a SQL answer with its mark, rows and statement

## What to build

BackOffice spec 3632, its web half for the panel (Q27, Q28, Q33).

- The SQL mode toggle, shown only to a reader the server says holds the SQL grant; a question asked with it on says so.
- The "Try in SQL mode" offer under a can't-answer; a tap asks the same question with the mode on.
- A SQL answer: the "SQL, not a certified figure" mark, every row, the statement (collapsed, with copy), the tables
  read, the count, the time, the cut line, and Save and Edit.

## Proof (→ `tdd` red-green cycles)

- [ ] The toggle shows for a grant holder only and sends the mode · oms-react tests
- [ ] The offer's tap re-asks with the mode on · oms-react tests
- [ ] A SQL answer draws the mark, the rows, the collapsed statement with copy, and the tables read · oms-react tests
- [ ] An answer with no SQL part draws as today · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3673 and 3674.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3673, BackOffice 3674
