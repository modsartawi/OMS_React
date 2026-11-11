---
status: open
spec: BackOffice .issues\3632-sql-mode-the-copilot-writes-and-runs-one-guarded-select-and-its-answer-can-be-saved-spec.md
blocked-by: BackOffice 3677
---

# 891 — The "SQL" and "SQL, verified" marks show in the library, on a board panel, in a report block and on the print page, with the "filters do not apply" and "can no longer run" messages

## What to build

BackOffice spec 3632 Q43, Q48, Q49: the marks wherever a SQL item is drawn, including the print page the PDF is made
from; a viewer can open the SQL behind a panel; the "filters do not apply to this SQL panel" line; the plain "can no
longer run" message with its reason in place of the chart.

## Proof (→ `tdd` red-green cycles)

- [ ] Library, board panel, report block and print page draw the mark · oms-react tests
- [ ] The "can no longer run" read draws the message and no chart · oms-react tests
- [ ] A board with filters draws the "filters do not apply" line on the SQL panel · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3677.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3677
