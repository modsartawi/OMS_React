---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3543-analytics-calculations-phase-2-share-within-a-parent-filtered-measures-averages-and-questions-across-areas-spec.md
blocked-by: BackOffice 3545, BackOffice 3546
---

# 863 — An author adds a share within a parent and a filtered measure

## What to build

BackOffice spec 3543 parts A and B (decisions 1–8, 30–31). The owner ruled that the copilot and the editor ship
together, so this ticket is on the critical path with the server's wave 1.

- **`within`** on the share and running-share pickers: a multi-select over the query's dimensions, offering some but
  not all of them. With `within`, top N and `until` read "in each {parent}".
- **"Add filtered measure"** (variants): a measure, its filters (dimensions the query does not break down by), and a
  label in both languages or neither. A variant then appears in every measure picker: calculations, sort and chart.
- **Labels:** the default variant label is "{measure} ({filter values})"; the default share-within label is "Share of
  {measure} in each {parent}", in EN and AR.
- **The 80 % note** per parent, from `untilReached` as a list.
- **Wire types** go in `src/core/models/analytics-calculations.ts` (861's single place).

## Spine reach

UI (editor fields, pickers, labels, panel note) / wire types

## Proof (→ `tdd` red-green cycles)

- [ ] Builder tests: `within` offers only the allowed dimensions; a variant filter cannot be on a broken-down dimension; a saved definition carries both · oms-react test suite
- [ ] Label tests: the EN and AR defaults, and the both-or-neither override · oms-react test suite
- [ ] **HITL:** a staging walk: a board panel of delivery share within region, and delivery value ÷ till value by region and city

## Boundaries

A cross-repo ticket: the server is BackOffice spec 3543. If a server change turns out to be needed, it is a new
BackOffice ticket, not an edit here.

## Done when

The builder tests are green, and the staging walk is recorded in Comments.

## Blocked by

BackOffice 3545, BackOffice 3546
