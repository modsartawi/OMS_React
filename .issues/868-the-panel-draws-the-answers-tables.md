---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3558-the-copilot-answers-in-15-seconds-without-losing-quality-spec.md
blocked-by: BackOffice 3564
---

# 868 — The panel draws the answer's tables

## What to build

BackOffice spec 3558 D5–D6, ticket 3564. When `CopilotAnswer.tables` holds tables, the panel draws each under the
summary as the analytics table form (sortable; its notes: until, notSplit, notFiltered; "All" rows last), with CSV/xlsx
download and "Open as view" (the editor seeded with the table's query). Long tables scroll inside the answer. An absent
or empty `tables` renders exactly as today.

## Proof (→ `tdd` red-green cycles)

- [x] A 152-row table renders all rows, in the order sent; a header click re-sorts · oms-react tests — `copilot-table.test.ts` a152RowTable_rendersEveryRow_inTheOrderSent_unsorted, aHeaderClickReSorts_andALongTableScrollsInsideTheAnswer
- [x] Notes and "All" rows as on a view panel · oms-react tests — until_*, notSplitAndNotFiltered_*, allRows_areListedLast_*; a cut table shows the view panel's truncated note (review c3235421)
- [x] "Open as view" opens the editor seeded with the query · oms-react tests — openAsView_opensTheEditorSeededWithTheTablesQuery (a view carries one sort key: the first `order` key)
- [x] No `tables`: the answer renders as today · oms-react tests — `answer.test.ts` noTables_theAnswerRendersAsToday

## Boundaries

Switched by the server (`Copilot:Speed:*`): with the switch off the panel sees today's answer and behaves as today.

## Done when

Proof boxes ticked.

## Blocked by

BackOffice 3564

## Build notes (2026-11-11)

Built on branch `spec/3558-copilot-speed` (534b7f29; review c3235421, 24927e26). Pure-function tests (no DOM test library). Not shown: `dataGap` (no view panel shows it either; follow-up).
