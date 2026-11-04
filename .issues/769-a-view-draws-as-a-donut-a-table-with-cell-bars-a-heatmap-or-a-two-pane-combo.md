---
status: open
spec: 766
blocked-by: 767
---

# 769 — A view draws as a donut, a table with cell bars, a heatmap or a two-pane combo

## What to build

- **Donut:** one additive measure, at most 6 slices plus "Other".
- **Table with cell bars:** AG Grid, spreading the core grid base, with a cell-bar renderer that
  isolates its own whole value; sort and top N.
- **Heatmap:** 1 measure × 2 dimensions. Recharts has none, so `core/charts` draws an accessible
  single-hue sequential grid with a value per cell in its tooltip and the table view.
- **Combo:** two panes stacked on one shared x-axis, the volume measure as bars above and the rate
  as a line below, each pane with its own single y-axis (766 §E amendment 1).

## Spine reach

component (`core/charts`: donut, heatmap, combo; the table cell renderer) · store/logic · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `view model: a donut refuses a rate or percentile measure and folds past 6 slices` · pure (vitest)
- [ ] `view model: the heatmap's sequential scale maps min→lightest and max→darkest on one hue` · pure (vitest)
- [ ] `donut, table, heatmap and combo draw in en/ar/dark` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

The grid-base lint gate holds (every `<AgGridReact` spreads `OMS_GRID_BASE_COL_DEF`). Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

All four forms render in the drive, and `npm run lint` is green.

## Blocked by

[767](767-an-analytics-view-opens-at-analytics-view-id-and-draws-its-bar-chart-behind-the-analytics-probe.md)
