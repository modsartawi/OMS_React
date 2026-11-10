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

- [x] The builder offers only the allowed measures per kind, and change stays disabled until compare is on
- [x] A running share sets the order and is hidden with a date dimension or series
- [x] The saved definition carries `calculations` exactly as the wire expects (key, kind, measure, of, until, label)
- [x] Label override: both languages or neither
- [x] The chart picker refuses a donut and a stacked bar for a calculated column, and allows a combo line
- [x] Removing a used measure drops its calculation with a note
- [x] typecheck + lint + build clean
- [x] **HITL:** on staging, build a board panel with a delivery-value bar and its share as a line, and a report text
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

## Comments

**2026-11-10 — code part built (branch `impl/3519-862`), HITL staging walk still OPEN.** Status stays `open` until the
staging walk (last proof) is done and recorded here; it needs BackOffice 3520/3524 deployed.

- `boards/calculations-edit.ts` (pure, `calculations-edit.test.ts`): the kinds offered and why not (four max; change
  needs compare; running share refuses a date breakdown, named series, and a second running share), the measures per
  kind (additive; any for change), a ratio's `of` (other additive, same unit), keys (`share_<m>`, `ratio_<m>_<of>`,
  `running_<m>`, `change_<m>`, de-duplicated against measures, dimensions and other keys, ≤ 40), `until` clamped
  1–100, the label override (both languages or neither), and `settleCalculations`, which drops what the query no longer
  allows and reports it. It also pins a running share's order (`chart.sort` = its measure, descending, which the server
  reads as the order when `query.order` is absent), and drops a sort on a calculated key that went.
- `boards/CalculationFields.tsx`: the "Add calculation" control, used in the view editor (and so a board's "build a new
  view") and in the report panel editor. A dropped calculation is named in a note until it is dismissed.
- `shape-rules.ts`: `ShapeSelection.calculations` counts each calculated column as a `rate` measure (no donut, no
  stacked bar, a combo's line). `panel-edit.ts` settles calculations on every fit, compare toggle and settings change.
- Sorting by a calculated key is offered in the sort picker. Beside a running share, the picker is fixed on its measure.
- The editor names a calculation the way the panel heads its column, using 861's `calculationLabel` with `useCalculationWords()`. The interim local name was dropped after merging 861.
- The 80 % note is 861's (`untilReached`). It is not duplicated here.
- `npm run lint`: the boundary gate fails on four pre-existing violations in `insurance-rules/aliases/door-shapes.test.ts`.
  They are there with this change stashed, too. The other four gates are clean.
- 2026-11-11, local walk on live POS_Analytics (owner accepted it in place of staging): delivery value (DL + QC) by
  city as a combo, bars plus its share as a line, top 10 — share over all cities (Riyadh 26.0 %), saved, on the walk
  board and in the walk report. The share itself is not a live figure (spec 3519 D15: over the whole selection it is
  100 %), so the report text quotes the ratio instead: "15.0% of our till value came through delivery" — checked,
  66,692,042.21 / 444,375,816.41 = 15.01 %. Fixed on the way: the combo's percent axis (e6e911df), live figures
  named by key, and "Add … to the board" in the report designer.
