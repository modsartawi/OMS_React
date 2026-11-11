---
status: done
spec: BackOffice .issues\3632-sql-mode-the-copilot-writes-and-runs-one-guarded-select-and-its-answer-can-be-saved-spec.md
blocked-by: BackOffice 3675, 888
---

# 889 — The save dialog saves a SQL answer with a title, a chart type and its column mapping

## What to build

BackOffice spec 3632 Q39, Q41: Save on a SQL answer opens a dialog: the title, the chart type (only types the result's
columns fit), which column is the axis, the series and the values, and each value's label and format. Default: a table.

## Proof (→ `tdd` red-green cycles)

- [x] Only fitting chart types are offered · oms-react tests
- [x] Save sends the statement, the question, the title and the mapping · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3675.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3675, 888

## Build notes

Built 2026-11-12 on `t889` (from `spec/3632`), test-first: `src/features/copilot/sql-save.test.ts` (12, red before
green), against BackOffice 3675's wire, written into `src/core/models/analytics-sql.ts` (`AnalyticsSqlItemCreate`,
`AnalyticsSqlChart`, `AnalyticsSqlValueColumn`, `AnalyticsSqlDefinition`, the limits) beside the fit table
`sqlChartOffers` and `numericColumns`, in `core` so 890/891 can reuse it (the analytics designer's `shape-rules` are keyed
on the cube model and live in a feature, so they could not be reused).

- **Fit.** A type is offered when some choice of axis, series and value columns fits 3675's table; a value column is one
  whose every non-NULL cell is a number in the run's invariant text (the server's own test over typed cells, so a
  NULL-only column passes too). Any column may be the axis or series, as on the server. Unfitting types are left out
  of the picker, not shown disabled.
- **Dialog** (`SqlSaveDialog.tsx`, state pure in `sql-save.ts`): title en/ar (prefilled from the question in its own
  script, ≤200), type, axis, series (optional for line/area/bar, required for heat map), values each with column,
  label en/ar and format. Picking a type keeps a still-valid axis and each value's label/format. Save is disabled
  with the reason under it until `sqlSaveProblem` is null; the server's refusal (428/406/425/408/409) is shown in its own
  words. Table sends `chart: { type: "table", values: [...] }` (values may carry labels/formats); the question is cut
  to 2,000.
- **Save button** in `SqlAnswer`'s footer when a statement ran with columns and the turn's question is known
  (`Answer` takes `question`; the panel passes `turn.question`; the rules page's Try passes none, so no Save there).
  After a save: a toast and "Open it" → `viewHref(id)`. Drawing a SQL item on the view page is 891's.
- Not driven in a browser (no RTL; the dialog is a thin renderer over the tested module).
