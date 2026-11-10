---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3543-analytics-calculations-phase-2-share-within-a-parent-filtered-measures-averages-and-questions-across-areas-spec.md
blocked-by: 863, BackOffice 3549, BackOffice 3550
---

# 864 — An author mixes areas and adds an average, and panels show unsplit totals

## What to build

BackOffice spec 3543 parts C and D (decisions 9–12, 14, 18, 30–32).

- **The measure picker** lists measures from every area, grouped by area, up to 4 areas. The dimension picker offers
  every dimension of the chosen areas and marks the figures a dimension will not split.
- **`average`** in the kind picker, with `of` free of the unit rule; the label is "{measure} per {of}".
- **"All" rows are kept apart** (owner, decision 12; the artifact *Unsplit Total Rows*):
  - `isTotal` rows are listed last in the table and the exports;
  - they are never a bar, slice or point;
  - the panel note carries the total and the `notSplit` sentence ("Deliveries cannot be split by category").
- **`notFiltered`:** the figure is marked "not filtered by {dimension}", with a panel note.
- **`dateBasis`** in the column header's tooltip on a cross-area panel.

## Spine reach

UI (pickers, table, charts, exports, panel notes) / wire types

## Proof (→ `tdd` red-green cycles)

- [x] Tests: "All" rows are last in the table and the exports, and never in a chart series · oms-react test suite
- [x] Tests: the `notSplit` and `notFiltered` notes in EN and AR; `dateBasis` in the header · oms-react test suite
- [x] Tests: the measure picker groups by area and stops at 4 areas; `average` has no unit rule · oms-react test suite
- [x] **HITL:** a staging walk: a board of till sales and deliveries by region × category with a category filter

## Boundaries

A cross-repo ticket: the server is BackOffice spec 3543. If a server change turns out to be needed, it is a new
BackOffice ticket, not an edit here.

## Done when

The tests are green, and the staging walk is recorded in Comments.

## Blocked by

863, BackOffice 3549, BackOffice 3550

## Comments

- 2026-11-10 (implementer): built test-first on `3519-864`. Wire (`analytics-calculations.ts`, `wire.ts`): `average`,
  `notSplit`, `notFiltered`, `column.dateBasis`, the row's `isTotal`. `./unsplit`: "All" rows never drawn (every chart
  builder), listed last in the panel table, the table form (after sort and top N, not clickable) and the CSV/xlsx, the
  unsplit dimension reading "All"; `AreaNotes` carries the `notSplit` sentence with each total and the "not filtered by"
  note; `dateBasis` (and the not-filtered mark) in the table column header tooltip. Editor: measures from every area,
  grouped, chosen areas first, a fifth blocked; breakdowns of any chosen area (notBy only from a measure's own area),
  each naming the figures it will not split; a variant of any area within four; `average` with `of` free of the unit
  rule, "{measure} per {of}", formatted by `column.unit`. canBind mirrors 3548/3551 (a measure option of another area
  binds; members binds when some area has the dimension; variant keys read as their measure). 863's gap fixed (title
  and report panel area of a variant-only query). Tests: `cross-area.test.ts`, `average.test.ts`.
- **Open (HITL):** the staging walk — a board of till sales and deliveries by region x category with a category filter.
- 2026-11-10, local walk on live POS_Analytics (not the staging walk; the HITL box stays open): item sales value and
  deliveries by city x category, view filter BABY CARE + PHARMA-OTC, on board 06GWDRJYSR1G6C719CTA04WJV4 with a
  Category parameter (BABY CARE). One "All" row per city, last, item value empty (never 0); notes "Deliveries cannot
  be split by Category" and "Deliveries is not filtered by Category"; header tooltip carries the date basis. The
  board Category reaches the panel (some measure's area has it). Found and fixed: the table's note repeated all 155
  "All" rows (4672d667); a SAR + percent series chart had no pane names and odd percent ticks (96f57698).
  Unconfirmed: the header tooltip's second line (not filtered) is in the column definition, but only the first line
  was seen on screen.
- 2026-11-10: owner accepted the local walk (live POS_Analytics, notes above) in place of the staging walk. A short
  staging check after deploy (open the walk board, one scheduled Arabic report) covers the build, RTL and the PDF.
