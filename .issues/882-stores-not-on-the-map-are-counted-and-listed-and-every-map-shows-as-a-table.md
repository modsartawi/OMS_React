---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: BackOffice 3639, 880
---

# 882 — Stores not on the map are counted and listed, and every map can be shown as a table

## What to build

BackOffice spec 3630, M21 and M24; ticket BackOffice 3639. A store with no coordinates is never dropped silently.

- **Under the map, one line:** "N stores are not on the map", from the count the server sends. It is not shown
  when the count is zero.
- **The line opens the list** of those stores, with the same figures as the map's rows.
- **When no row has coordinates,** the table is drawn in place of the map, with that line.
- **"Show as table"** is on every map. It shows the same rows, sorted and formatted as a table chart shows them,
  and switches back to the map.
- **When the panel of 879 says it cannot draw,** the table is shown with the line "The map could not be drawn".

## Proof (→ `tdd` red-green cycles)

- [x] With 3 of 40 rows lacking coordinates, the line says 3 and the list holds those 3 with their figures · oms-react tests
- [x] With none lacking, there is no line · oms-react tests
- [x] With every row lacking, the table is drawn in place of the map, with the line · oms-react tests
- [x] "Show as table" shows every row of the result, the placed and the unplaced, and switches back · oms-react tests
- [x] When the map cannot draw, the table and its line are shown · oms-react tests
- [x] Both lines read correctly in Arabic and in English, with Latin digits · oms-react tests

## Boundaries

Behind the server's `Analytics:MapChart`. The count comes from the server; the panel does not count rows itself
for the line.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

BackOffice 3639, 880.

## Comments

**Built 2026-11-17** (branch `spec/3630-882`). Tests: `src/features/analytics/boards/map-not-on-map.test.ts` (17, in
memory; the view drawn to static markup in en and ar). `npm test` 10,905/10,905, `typecheck` and `build` green; every
`lint` gate green except `check-boundaries`, whose 4 insurance-rules findings are pre-existing on `spec/3630-map-chart`.
Mutation-checked: counting the unplaced rows on the client instead of reading the server's count fails
"the count is the server's".

- **The count** is the server's `legend.notOnMap` (BackOffice 3639), read by `readResult` into `result.notOnMap` (absent on
  any other answer). The line is a link-styled button; it opens and closes the list under it. The LIST's rows are the
  rows with a null coordinate (the list has to name them), but the NUMBER on the line is never counted by the panel.
- **One table for every map table** (`map-chart.ts` `mapTableView`, drawn by `MapTable.tsx`): "Show as table", the table
  in place of a map with no placed row, the cannot-draw table and the not-on-map list (`notOnMapTableView`) all show the
  same columns and order — the table chart's own (`toTableView`: the first measure largest first, or the view's saved
  sort), never cut by a top N. Columns: store, **store name, city** (the `place` texts, so a reader can tell the stores
  apart), then the measures. **Hidden:** `latitude`/`longitude` (they are what put the store on the map, not a figure)
  and the 3639 `legend` columns `hollow`/`colour_step` (drawing instructions).
- **What shows** (`mapDisplay`): cannot draw → the table + "The map could not be drawn", no switch; no row placed → the
  table + the not-on-map line, no switch (there is no map to go back to); "Show as table" → the table + "Show as map";
  else the map + "Show as table" + the line when the server counted any. The line is under the map only; the table view
  lists every row anyway.
- **The panel's own "View as table" action is hidden for a map** (`PanelActions.tsx`): the map's switch is on every map
  (also report blocks and the copilot, which have no panel actions), and two switches would show two different tables.
  The CSV/xlsx downloads are unchanged (`panelTable`).
- Words in en and ar (Arabic plurals in all six forms, Latin digits through `fsi(count)`).
- For 881: `MapBody` in `ViewChart.tsx` now wraps the panel in `data-map-body` with the switch above and `MapLine` below;
  the legend and the card slot in beside the `LazyMapPanel`. For 883: the cannot-draw path already draws the table with
  "The map could not be drawn" (`data-map-cannot-draw`); the 20-second rule can set the same state.
