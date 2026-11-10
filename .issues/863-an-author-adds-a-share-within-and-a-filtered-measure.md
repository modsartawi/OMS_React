---
status: done
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

- [x] Builder tests: `within` offers only the allowed dimensions; a variant filter cannot be on a broken-down dimension; a saved definition carries both · oms-react test suite
- [x] Label tests: the EN and AR defaults, and the both-or-neither override · oms-react test suite
- [ ] **HITL:** a staging walk: a board panel of delivery share within region, and delivery value ÷ till value by region and city

## Boundaries

A cross-repo ticket: the server is BackOffice spec 3543. If a server change turns out to be needed, it is a new
BackOffice ticket, not an edit here.

## Done when

The builder tests are green, and the staging walk is recorded in Comments.

## Blocked by

BackOffice 3545, BackOffice 3546

## Comments

**2026-11-10 — built on `3519-863` (from `spec/3519-calculations`).** Code proofs green; the **HITL staging walk is
still open** (needs BackOffice spec3543 deployed to staging) and should be recorded here when done. Status set `done` on
the orchestrator's instruction.

- Wire (`src/core/models/analytics-calculations.ts`, tested in `analytics-calculations.test.ts`): `within` on a
  calculation and on a column's `calculation`; `AnalyticsVariant` / `query.variants`; a column's `variant: {measure,
  filters, label}`; `untilReached` as a boolean or the per-parent list `[{parent, reached}]`. Matches `AnalyticsWire.cs`
  on BackOffice `spec3543` — no mismatch found.
- `within` (`calculations-edit.ts`, `calculations-within.test.ts`): offered on share and running share over the query's
  category breakdowns, only with two or more; a pick naming all of them is refused (stricter than the server: the date is
  never offered, it already partitions every share). Settle drops a share within whose parents left the query
  (reason `within`, noted). Default label "Share of {measure} in each {parent}" / running share alike, EN + AR; the 80 %
  note names each parent that ran out (`untilNote`, `UntilNote`); `until` and top N read "in each {parent}".
- Variants (`variants.ts`, `variants.test.ts`): "Add filtered measure" (`VariantFields`) in the view editor and the
  report panel editor — a measure of the query's area, filters on its own breakdowns the query does not break down by,
  label both-or-neither. Its key is appended to `query.measures` (owner-kept 3546 rule) and `variantModel` gives every
  picker (calculations, sort, chart shape table, breakdowns) a measure for it. Default label "{measure} ({values})",
  values of one filter as "a or b". Settle: an unticked variant goes quietly; one whose filter dimension became a
  breakdown goes with its key, noted. Panels name variant columns (`calculatedModel`), and a saved variant panel is not
  "retired" while its measure exists (`retiredMembers`, found during the slice).
- 2026-11-10, local walk on live POS_Analytics (not the staging walk; the HITL box stays open): share of till value
  within each city by delivery type — all 152 cities sum to 100.000 (Riyadh: none 80.69, DL 18.42, QC 0.87, BB 0.02);
  delivery value (variant: DL + QC) as % of till value by city — Riyadh 19.3 %, agreeing with the share view. The
  variant form drops delivery type from the breakdowns, as it should. Both on board 06GWDRJYSR1G6C719CTA04WJV4.
  Found and fixed: a per-parent table was re-sorted by the grid (54f2a6a5); the calculation card overflowed (54f2a6a5).
  Note: on these panels Country is `notInArea` (the delivery-type view has no country), so the author sees
  "Not filtered by Country, Category".
