---
status: open
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

- [ ] With 3 of 40 rows lacking coordinates, the line says 3 and the list holds those 3 with their figures · oms-react tests
- [ ] With none lacking, there is no line · oms-react tests
- [ ] With every row lacking, the table is drawn in place of the map, with the line · oms-react tests
- [ ] "Show as table" shows every row of the result, the placed and the unplaced, and switches back · oms-react tests
- [ ] When the map cannot draw, the table and its line are shown · oms-react tests
- [ ] Both lines read correctly in Arabic and in English, with Latin digits · oms-react tests

## Boundaries

Behind the server's `Analytics:MapChart`. The count comes from the server; the panel does not count rows itself
for the line.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

BackOffice 3639, 880.
