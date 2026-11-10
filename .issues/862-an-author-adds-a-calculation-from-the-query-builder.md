---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3519-analytics-calculations-shares-ratios-running-share-and-change-computed-by-the-server-spec.md
blocked-by: 861, BackOffice 3524
---

# 862 — An author adds a calculation from the query builder

## What to build

BackOffice spec 3519 slice 2 (decisions 23–26). After 861 the web shows calculated columns. This ticket lets an
author **add** them by hand in the query builder that views, board panels and report panels share (the editor
fields under `features/analytics/boards`, `view-model-forms.ts`).

- **"Add calculation"**, up to 4 per query:
  - **kind**: share of total, ratio, running share, change;
  - **measure**: limited to the query's additive measures (any measure for change);
  - **of** (ratio only): limited to the query's other additive measures in the same unit;
  - **until** (running share only, optional, 1–100).
- **It offers only what the server allows** (spec 3519 decisions 7–10):
  - change is disabled until "compare with previous period" is on;
  - running share sets the order to its measure descending, and is not offered with a date dimension or named
    series;
  - sorting by a calculated column is offered, but not alongside a running share.
  A server 406 still shows through the existing refusal note (`EditorRefusalNote`), because the server stays the
  authority.
- **Label override:** optional, both languages or neither. The default is 861's derived label.
- **Chart pickers** treat a calculated column as a rate measure: never on a donut, never stacked, and allowed as a
  combo's line. These match the server's shape rules (BackOffice 3524).
- Removing a measure that a calculation uses removes that calculation, with a visible note, rather than leaving a
  definition the server refuses.

## Spine reach

UI (query builder, chart picker) → SIS.Api analytics item store (save) and query door (preview)

## Proof (→ `tdd` red-green cycles)

- [ ] The builder offers only the allowed measures per kind, and change stays disabled until compare is on
- [ ] A running share sets the order and is hidden with a date dimension or series
- [ ] The saved definition carries `calculations` exactly as the wire expects (key, kind, measure, of, until, label)
- [ ] Label override: both languages or neither
- [ ] The chart picker refuses a donut and a stacked bar for a calculated column, and allows a combo line
- [ ] Removing a used measure drops its calculation with a note
- [ ] typecheck + lint + build clean
- [ ] **HITL:** on staging, build a board panel with a delivery-value bar and its share as a line, and a report text
      that quotes the share as a live figure; save, reopen, and check that both render

## Boundaries

oms-react only. There is no server change; if one turns out to be needed, it is a new BackOffice ticket. This ticket
replaces BackOffice 3526, which now points here.

## Done when

An author can add, edit and remove calculations in the query builder for a view, a board panel and a report panel,
and the staging walk is recorded in Comments.

## Blocked by

- [861](861-a-panel-shows-the-calculated-columns-the-server-returns.md)
- BackOffice [3524](C:/Work/DMSCO/BackOffice/.issues/3524-views-boards-and-reports-keep-calculations-chart-shape-rules-round-trip-and-live-report-figures.md)
