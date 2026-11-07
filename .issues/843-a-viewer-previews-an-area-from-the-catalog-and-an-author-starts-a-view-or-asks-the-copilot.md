---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md
blocked-by: 841, BackOffice 3441
---

# 843 — A viewer previews an area from the catalog in a grid, and an author starts a view or asks the copilot from a node

oms-react half of BackOffice spec 3437 (`C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md`), §G; the server spec is the normative wire.

## What to build

BackOffice spec 3437 §G, user stories 35–38, 49–51.

- **Preview** on an area or measure node: `POST Analytics/Catalog/Preview` with the defaults, shown in AG Grid
  (bilingual headers, the formats charts use). A period picker and a column chooser re-run the preview. Dropped
  measures get a note, and refusals use `refusalWords`.
- **Author actions:** "New view from this" opens the builder pre-filled with the measure (or the area's first
  measure) and dimension. "Ask about this area" opens the ask box scoped to the area. Runners see neither.

## Spine reach

UI / api / tests.

## Proof (→ `tdd` red-green cycles)

- [ ] `preview request carries the defaults and re-runs on period change` · vitest
- [ ] `dropped measures show a note` · vitest
- [ ] `new view from a measure pre-fills the builder link` · vitest
- [ ] `runner sees no author actions` · vitest

## Boundaries

Web only.

## Done when

Proofs green; on staging a preview of Item sales shows 200 rows by day.

## Blocked by

[841](841-the-catalog-page-browses-areas-members-marts-and-sources-as-a-tree.md), BackOffice [3441](C:/Work/DMSCO/BackOffice/.issues/3441-any-viewer-previews-an-area-through-cube-200-rows-by-day-for-the-last-7-days.md)
