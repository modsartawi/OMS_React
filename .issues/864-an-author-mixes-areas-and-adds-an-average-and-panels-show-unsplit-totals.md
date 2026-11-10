---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3543-analytics-calculations-phase-2-share-within-a-parent-filtered-measures-averages-and-questions-across-areas-spec.md
blocked-by: 863, BackOffice 3549, BackOffice 3550
---

# 864 — An author mixes areas and adds an average, and panels show unsplit totals

## What to build

BackOffice spec 3543 parts C and D (decisions 9–12, 14, 18, 30–32).

- **The measure picker** lists measures from every area, grouped by area, up to 4 areas. The dimension picker offers
  every dimension of the chosen areas and marks the figures a dimension will not split.
- **`average`** in the kind picker, with `of` free of the unit rule; the label is "{measure} per {of}".
- **"All" rows are kept apart** (owner, decision 12; the artifact *Unsplit Total Rows*):
  - `isTotal` rows are listed last in the table and the exports;
  - they are never a bar, slice or point;
  - the panel note carries the total and the `notSplit` sentence ("Deliveries cannot be split by category").
- **`notFiltered`:** the figure is marked "not filtered by {dimension}", with a panel note.
- **`dateBasis`** in the column header's tooltip on a cross-area panel.

## Spine reach

UI (pickers, table, charts, exports, panel notes) / wire types

## Proof (→ `tdd` red-green cycles)

- [ ] Tests: "All" rows are last in the table and the exports, and never in a chart series · oms-react test suite
- [ ] Tests: the `notSplit` and `notFiltered` notes in EN and AR; `dateBasis` in the header · oms-react test suite
- [ ] Tests: the measure picker groups by area and stops at 4 areas; `average` has no unit rule · oms-react test suite
- [ ] **HITL:** a staging walk: a board of till sales and deliveries by region × category with a category filter

## Boundaries

A cross-repo ticket: the server is BackOffice spec 3543. If a server change turns out to be needed, it is a new
BackOffice ticket, not an edit here.

## Done when

The tests are green, and the staging walk is recorded in Comments.

## Blocked by

863, BackOffice 3549, BackOffice 3550
