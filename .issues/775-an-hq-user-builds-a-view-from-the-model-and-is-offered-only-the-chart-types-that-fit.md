---
status: done
spec: 766
blocked-by: 769
---

# 775 — An HQ user builds a view from the model and is offered only the chart types that fit

## What to build

`/analytics/new?kind=view`, and "Save as view" from drill by:
- choose measures, breakdowns, filters, sort and top N from `Analytics/Model` only;
- the **shape-rules** pure module offers only the fitting chart types and says why the others are
  unavailable (755 Q3 with 766 §E's amendments);
- number format, legend position, series colours from the chart tokens only, and a title and
  subtitle in English and Arabic. An empty title is generated from the model labels through `t()`;
- a live preview through `Analytics/Query`;
- saving creates a Personal view (`POST Analytics/Item`).

The refusals: `ANALYTICS-406` names the field, `407` offers to shorten the window, and `410` shows
the area's reason.

## Spine reach

model/api (`Item` create) · store/logic (shape rules, title generation) · component/route (editor) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `shape rules: 755's table plus the amendments — a rate never in a donut or stacked, a combo needs one volume and one rate, more than 5 members folds` · pure (vitest)
- [x] `generated title: measure by dimension, over period, from model labels, in en and ar` · pure (vitest)
- [x] `build Q8 from the model, see only fitting types, save, land on the new view; 407 offers a shorter window` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive builds and saves a view, and the pure tests are green.

## Blocked by

[769](769-a-view-draws-as-a-donut-a-table-with-cell-bars-a-heatmap-or-a-two-pane-combo.md)
