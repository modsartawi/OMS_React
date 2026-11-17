---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: BackOffice 3641, 880
---

# 884 — The copilot panel draws a map above its table

## What to build

BackOffice spec 3630, M42; ticket BackOffice 3641. A reader asks "show me sales by store on a map", and the panel
draws one, with or without the author grant.

- **An answer that carries a map part** is drawn as a map, through the panel of 879, above the table of the same
  rows. The table is always there, so the copilot's words can be checked against the rows.
- **The map is the one a board draws:** the legend, the groups, the card, the "stores not on the map" line and
  "Show as table" as they stand when this is built (881, 882).
- **It fits the panel's width,** and the reader can open it larger.
- **An answer with no map part** is drawn exactly as today, and loads no map code.
- **When the map cannot be drawn,** the table alone is shown, with the line "The map could not be drawn".

## Proof (→ `tdd` red-green cycles)

- [x] An answer with a map part draws the map panel above its table, with the result's points and legend · oms-react tests (the panel's answer tests)
- [x] An answer without one renders as today · oms-react tests
- [x] The answer's contract type gains the map part first, and an answer from a server without it still parses · oms-react tests
- [x] When the map cannot draw, the table and the line are shown · oms-react tests
- [ ] A reader with the view grant only sees the map on the local stack, in English and in Arabic · seen by a person, screenshot

## Boundaries

Switched by the server (`Copilot:Charts:Map`, which needs `Analytics:MapChart`): with either off, no answer
carries a map part and the panel behaves as today. The panel computes no figure.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

BackOffice 3641, 880.

## Comments

**2026-11-17 — built (branch `spec/3630-884`).** `test` 10,971 green (797 files), `typecheck` and `build` green; `lint`: the
grid/contrast/palette/control gates and the map-build gate green, ⚠ `check-boundaries` red with the **4 insurance-rules
findings already on `spec/3630-map-chart`** (879's note), none from 884.

- **Contract** (`src/core/models/copilot.ts`): `CopilotAnswerTable.map?: CopilotAnswerMap` (`{ legend: AnalyticsMapLegend }`,
  3641's wire), and `CopilotTableColumn.role` gains `place` / `legend`. `copilotAnswerModel` keeps a table's map part only
  when it holds a legend object; a table from a server without it parses as before (`answer-map.test.ts`).
- **Reading** (`copilot-table.ts`): the copilot's string cells become what a map view's answer carries — `latitude` /
  `longitude` numbers (null = not on the map), `hollow` a flag — and the legend rides into the result through `readResult`
  (so `notOnMap` is the server's count). `CopilotTableParts.map` is the table's own query under `chart: map`.
- **Drawing**: `MapBody` moved out of `ViewChart.tsx` into `./MapBody.tsx` unchanged, plus `tableBelow` and `className`.
  `CopilotTableEmbed` draws it above the grid with "Larger map" (a 72rem dialog, `h-[70vh]` map, mounted only while open).
  With `tableBelow`, a map that cannot draw — or has no placed row — draws no table of its own (`mapDisplay` → `shows:
  'none'`), only its line, over the answer's table of the same rows. "Show as table" is still the board's (`MapTable`,
  with store name and city). The grid under the map shows the table's own columns only (place/legend columns are not in
  its query), identical to the same rows without a map part.
- Tests: `src/features/analytics/boards/copilot-map-answer.test.ts` (static markup, en + ar; the cannot-draw branch is
  driven through the print context's `fell-back`, the same `fellBack` the panel's own cannot-draw sets) and
  `src/features/copilot/answer-map.test.ts`. Mutation-checked: dropping `tableBelow` reds the cannot-draw test; reading
  `hollow` as the raw string reds the points test.
- **Left open:** the "seen by a person" box (view grant only, local stack, en + ar) — so the ticket stays `open`.
