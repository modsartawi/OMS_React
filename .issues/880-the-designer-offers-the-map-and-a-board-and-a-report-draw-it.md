---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: BackOffice 3635, BackOffice 3638, 879
---

# 880 — The designer offers Map when the query fits and says why when it does not; a board panel and a report block draw it

## What to build

BackOffice spec 3630, M13, M22, M25 and M26; ticket BackOffice 3638. An author builds a map like any other chart.

- **The analytics contract changes first:** the chart type `map`, the extra columns a map result carries (the
  coordinates, the store's name and city), and the list of chart types the door accepts.
- **The designer offers "Map"** in its chart choices, only when the server says it accepts `map`.
- **Offered when the query fits:** one dimension, which is the store; no date; one or two measures; no named
  series. Otherwise it is listed as unavailable with the reason, in both languages. The server stays the
  authority and refuses the rest.
- **The author chooses which measure is the size and which is the colour.** The first measure is the size; a
  control swaps the two.
- **A saved view, a board panel and a report block draw the map** through the panel of 879, with the result's
  points. Points are plain until 881.
- **Filters, the period and the board's filters** act on a map as on any chart.
- **A map tile on a board has a minimum size.** Default: half the board's width, and tall enough for the legend
  and the map together. The grid does not let it shrink below that.
- **A map emits no cross-filter and has no drill** (M23).

## Proof (→ `tdd` red-green cycles)

- [x] "Map" is offered for one store dimension with one or two measures, and only when the server accepts `map` · oms-react tests (the shape rules)
- [x] By city, with a date, with three measures or with named series it is unavailable, each with its reason in both languages · oms-react tests (the shape rules)
- [x] Swapping the two measures swaps size and colour in the saved definition · oms-react tests (the editor)
- [x] A view of type `map` hands the map panel one point per row that has coordinates · oms-react tests
- [x] A board panel and a report block of type `map` draw the map panel, and a board without one loads no map code · oms-react tests
- [x] A map tile cannot be sized below its minimum · oms-react tests (the board grid)
- [x] A view saved as a map opens in the designer as a map · oms-react tests

## Boundaries

Behind the server's `Analytics:MapChart`: with it off the server does not list `map`, and the designer, the
boards and the reports behave as today. The web's copy of the shape rule only chooses what to offer.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

BackOffice 3635 (the local PDF proof: nothing after 879 is built until it passes), BackOffice 3638, 879.

## Comments

**2026-11-17 — built (branch `spec/3630-880`).** All proof boxes in `src/features/analytics/boards/map-chart.test.ts`
(20 tests, red first, one slice per box); `npm test` 10,888/10,888, `typecheck` and `build` green; `lint`: every gate green
except `check-boundaries`, whose 4 findings are the pre-existing insurance-rules ones already red on `spec/3630-map-chart`
(879's note), none from this ticket.

- **Contract** (`@/core/models/analytics`): `AnalyticsChartType` gains `map`; `AnalyticsModel.chartTypes` (wire
  `chartTypes`, 3638) read by `readModel` keeping only known types, absent stays absent; column role `place`.
- **Offer** (`shape-rules`): `map` is listed (last, after the eleven choices) **only** when `chartTypes` names it, so with
  `Analytics:MapChart` off the designer is exactly today's. Shape as the server's `AnalyticsMapChart.Fits`: no series
  (`mapSeries`), no date (`mapDate`), exactly the `store` breakdown (`mapStore`), 1-2 measures with calculations
  counted (`mapMeasures`). Words in both bundles. The view's own preconditions (store name, city, coordinates on the
  view) and cross-area stay the server's — it refuses with 406.
- **Size and colour** (`map-chart.ts`): first measure = size, second = colour; `swapMapMeasures` reverses the query's
  two measures. A "Swap size and colour" control (with the two roles named) in `ChartFields`, wired in the view
  designer and the report block editor.
- **Drawing**: `ViewChart` draws `LazyMapPanel` for type `map` with `mapPoints(result)` (one point per row with both
  coordinates, memoised per answer); every board panel, report block, view page and copilot embed reaches it through
  `PanelBody`. `cannot-draw` falls back to the table form. No `onPoint` (no cross-filter) and `drillTargets` returns
  none for a map (M23). `check-map-build` (in lint) stays green with the import in place: no analytics chunk reaches map
  code statically.
- **Board grid**: map minimum `{ w: 6, h: 7 }` — half the 12 columns, 7 rows of 5rem = 560 px for the map and the
  legend (881/882 draw the legend; revisit the height if their legend needs more).
- **Designer reopen**: the choice logic moved into `designerChoice` (shape-rules), used by the editor page; a saved map
  opens as a map, and on a server without `map` falls back to the suggestion.

Left for later tickets: points are plain (881); legend/not-on-map list/table toggle (881/882); the board/report map box
uses the panel's default `h-80 w-full` — a printed map needs a fixed size + the 3635 `preserveDrawingBuffer` (already in
the engine); 883 owns the print page's size and readiness. Not driven in a browser against a live SIS.Api with the
switch on (no proof box asks for it).

