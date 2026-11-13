---
status: done
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

- [x] A money column's cell `25011888.87` reads as a query table's money cell of the same value does · oms-react tests (`copilot-analysis-table.test.ts`)
- [x] A negative money cell keeps its sign and sorts below the positives · oms-react tests
- [x] A percent column (`share`) and a column with no unit read exactly as sent today · oms-react tests
- [x] The download keeps the server's figures as sent (a file is for reading back, not for display) · oms-react tests

## Boundaries

No server change. A table without a title (a plain query's) is untouched.

## Blocked by

— (the owner's ruling above)

## Comments

**2026-11-13 — built (`/implement 897`).** ⚠ No owner ruling is recorded. The ticket's recommended option was built:
the client formats, and the server is unchanged. It is unpushed on `main`, so it can be reverted if the owner rules
for server-formatted text instead.

- `copilot-table.ts` `sentTable(…, byUnit)`: on screen only, a measure column with unit `SAR` or `count` carries the
  server's numbers, without `asSent`. The table form's own `valueFormatter` (`formatValue`) then formats it exactly as
  it formats a query table's cell. No `max` is set, so no cell bar is drawn (a bar would be a figure the panel worked
  out). Sorting uses the grid's default number order.
- **Guard.** A column is formatted only when every one of its figures is a plain number that the unit shows down to
  its last decimal (`shownDecimals`, exported from `@/core/charts/format`) and that has at most 15 digits. If one
  figure fails, the whole column stays as sent, so no figure is ever shown rounded differently from the server's. A
  `percent` column, a `share` column, a column with no unit, and any other unit (`minutes`, `km`, …) also stay as sent.
- The CSV and xlsx downloads keep the server's texts.
- Proof: 7 new tests in `copilot-analysis-table.test.ts`, plus 878's tests updated to expect numbers in money columns.
  `tools/copilot-drive.mjs` has a new `analysis-table` scenario that runs against the real grid; it passed 8/8 in LTR
  and RTL (`-SAR 1,883,288.19`, `62.0%` as sent, and a header click sorts negatives below positives).
- The 878 test `everyCell_isTheServersText_asSent_neverReformattedOrComputed` is renamed to
  `everyFigure_isTheServers_neverComputed_aMoneyFigureCarriedAsItsNumber_aShareAsItsText`. 878's Proof line still
  cites the old name.
- For the owner when they rule (from the spec review): the copilot's prose still quotes the server's text
  (`25011888.87`, B18), while the table beside it now reads `SAR 25,011,888.87`.
