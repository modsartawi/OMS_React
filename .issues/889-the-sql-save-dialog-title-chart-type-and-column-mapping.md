---
status: open
spec: BackOffice .issues\3632-sql-mode-the-copilot-writes-and-runs-one-guarded-select-and-its-answer-can-be-saved-spec.md
blocked-by: BackOffice 3675, 888
---

# 889 — The save dialog saves a SQL answer with a title, a chart type and its column mapping

## What to build

BackOffice spec 3632 Q39, Q41: Save on a SQL answer opens a dialog: the title, the chart type (only types the result's
columns fit), which column is the axis, the series and the values, and each value's label and format. Default: a table.

## Proof (→ `tdd` red-green cycles)

- [ ] Only fitting chart types are offered · oms-react tests
- [ ] Save sends the statement, the question, the title and the mapping · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3675.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3675, 888
