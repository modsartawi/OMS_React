---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3587-the-copilots-analysis-tools-what-changed-against-the-others-and-the-headline-spec.md
blocked-by: —
---

# 897 — An analysis table's figures are formatted by their unit, as a query table's are

Found walking BackOffice 3629 (2026-11-12), with `Copilot:Analysis:WhatChanged` on, on today's data.

## What happened

"Why did sales fall last week?" drew five analysis tables (City, Store, New and stopped stores, Channel, Sale type).
Their figures read `25011888.87` and `-1883288.19`: no SAR and no thousands separators. In the same panel, a plain
query's table reads `SAR 1,896,344.65`. A reader comparing the two sees two different kinds of number.

The cause is a decision, not a slip. [878](878-the-panel-shows-an-analysis-results-tables-with-their-titles.md) draws
an analysis table "as sent: the panel does not compute or re-format a figure" (`copilot-table.ts`, `sentTable`,
`asSent: true`). The server's cells are plain numeric text, and each measure column already carries its `unit`
(`CopilotAnalysisRows`: `Unit`, `Shape`; the share columns are `percent`).

## What to build

An analysis table's measure cell is formatted by its column's unit, in the same way the table form formats a query
table's cell of that unit: money with its currency and separators, a count with separators, a percent as sent. The
panel still computes nothing: no figure is derived, rounded differently or re-signed, and sorting stays by the
number.

⚠ This reverses part of 878's "as sent" decision. **The owner rules on it before it is built.** The alternative is
for the server to send formatted text in the cells. That is not recommended: it moves display formatting into the
data library, and the number check still has to read the same figures.

## Proof (→ `tdd` red-green cycles)

- [ ] A money column's cell `25011888.87` reads as a query table's money cell of the same value does · oms-react tests (`copilot-analysis-table.test.ts`)
- [ ] A negative money cell keeps its sign and sorts below the positives · oms-react tests
- [ ] A percent column (`share`) and a column with no unit read exactly as sent today · oms-react tests
- [ ] The download keeps the server's figures as sent (a file is for reading back, not for display) · oms-react tests

## Boundaries

No server change. A table without a title (a plain query's) is untouched.

## Blocked by

— (the owner's ruling above)
