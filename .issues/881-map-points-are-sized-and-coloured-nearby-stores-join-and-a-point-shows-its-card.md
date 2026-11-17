---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: BackOffice 3639, 880
---

# 881 — Map points are sized and coloured from the server's legend, nearby stores join into one point, and a point shows its card

## What to build

BackOffice spec 3630, M15 to M20 and M23; ticket BackOffice 3639. This is what makes the map readable.

- **Size** shows the first measure, by area, between the smallest and the largest value the legend carries. A row
  the server marks "smallest, hollow" (zero, negative or empty) is the smallest point, drawn hollow.
- **Colour** shows the second measure, by the step the server put on each row. The panel compares no value with
  an edge.
  - A change has three colours: better, about the same, worse.
  - Any other measure has five steps of one colour.
  - With one measure, every point has one colour.
- **Better and worse differ in lightness as well as hue,** and pass the app's contrast and palette checks.
- **The legend** names both measures with the server's labels, in the screen's language, shows the size scale, and
  names each colour step in words.
- **Grouping.** Stores close together on screen join into one point until the reader zooms in. A group shows its
  number of stores. A click on a group zooms in to open it.
- **A group's sum.** A group also shows the sum of the size measure, only when the legend says the size adds up.
  When it does not (a rate), the group shows the count only. A group always has one neutral colour. This is the
  one place the panel adds figures.
- **The card.** Pointing at a store shows its name, its city and both figures, formatted exactly as the table
  formats them. A click or a tap pins the card; a second tap elsewhere closes it.
- **Figures are in Latin digits** in both languages, like every other chart.

## Proof (→ `tdd` red-green cycles)

The engine is a stand-in; the tests read what the panel would draw.

- [x] Each point's area follows its value between the legend's smallest and largest · oms-react tests
- [x] A row marked hollow is the smallest point, hollow · oms-react tests
- [x] Each point takes the colour of the step on its row; with one measure all points share one colour · oms-react tests
- [x] The legend shows both labels in the screen's language, the size scale, and each step's words · oms-react tests
- [x] A group shows its count, and the sum only when the legend says the size adds up · oms-react tests
- [x] A group's sum equals the sum of its rows as the server sent them · oms-react tests
- [x] A group has the neutral colour whatever its members' steps · oms-react tests
- [x] The card shows name, city and both figures in the table's format, and a tap pins it · oms-react tests
- [x] The colours pass `check-contrast` and `check-palette` · `lint`
- [x] Riyadh's stores are seen as groups that open on zoom, on the local stack · seen by a person, screenshot

## Boundaries

Behind the server's `Analytics:MapChart`. The panel computes nothing but a group's sum. No drill and no linked
filter from a point or a group.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

BackOffice 3639, 880.

## Comments

**Built 2026-11-17** on `spec/3630-881` (off `spec/3630-map-chart` 8d0c0ca1).

- **Core, `src/core/map/map-drawing.ts`** (pure, no MapLibre): `MapPoint` now carries `size` (its share of the legend's
  range), `hollow`, `ink` (a colour token), `weight` (the size figure as sent) and `card`. `featuresAt(points, zoom, grouping,
  inkOf)` is what the engine draws: radius by **area** (`pointRadius`: 4 to 20 px), a hollow point at the smallest size
  with no fill and its own colour as the ring, groups made greedily per whole zoom (40 px on screen, nothing joins from zoom
  18), a group always `--map-group`, its words the count and — only when `grouping.sums` — `formatSum(sum)`. `groupSum`
  is the one place the panel adds. `openingZoom` is the first zoom where a group's members are no longer one group: a click
  on a group eases there, centred on it. `cardAfter` is the card's rule: pointing shows, pointing away hides, a tap pins,
  a tap elsewhere closes, a tap on another store pins that one; a group has no card.
- **Panel/engine:** `openMapPanel` hands the engine `featuresAt(zoom)` + `labelInk`, takes `pointer`/`tap` events and
  answers with `zoomTo` or `onCard`. `maplibre-engine.ts` draws one data-driven circle layer (larger points beneath) and a
  symbol layer of group words (Noto Sans Medium), re-asks at each whole zoom, and reports pointer/tap by
  `queryRenderedFeatures`. `MapPanel` resolves tokens through computed style and draws the card (`data-map-card`,
  name/city in `<bdi>`, figures in `Ltr`).
- **Feature, `map-chart.ts`:** `mapDrawing(result, model, lang)` reads the legend (`readMapLegend` in `wire.ts`;
  `AnalyticsMapLegend` + column role `legend` in the model): size share from the legend's `min`/`max`, `hollow` and
  `colour_step` straight off the row (the panel compares no value with an edge — a test sends a row whose value says
  better and whose step says same, and it draws same), card figures through `formatValue` with the column's unit — proven
  equal to the table cell's own formatter in Arabic. A group's sum is `formatTick` (compact, Latin digits). An answer with
  no legend draws 880's plain points. `mapLegendView` + `MapLegend.tsx`: both labels in the screen language, the two scale
  ends as the table writes them, the hollow note when a row is hollow, and every step's colour and words.
- **Colours** (`global.css`, light-only like the map, bridged): `--map-better` #1d4e89, `--map-same` #7d828b, `--map-worse`
  #c4650f, `--map-none` #c9ccd1, five `--map-scale-*` teal shades, `--map-ring`, `--map-group`, `--map-group-ink`.
  `check-contrast` gained a map block: each step/ring/group ≥ 3:1 on `--card`, group words ≥ 4.5:1, **better vs worse ≥
  1.8:1 in lightness** (2.08), each scale shade darker than the last by ≥ 1.3:1. A scale of k < 5 steps is spread over the
  five (k = 4 → shades 1, 2, 4, 5; one step → the middle).
- **Mutation-checked:** a sum that skips the hollow row's negative figure, a group coloured by its first member, and a
  radius linear in the value each turn one test red.
- **Tests:** `src/core/map/map-drawing.test.ts` (23), `src/features/analytics/boards/map-legend.test.ts` (24); whole suite
  792 files / 10935 green; `build` green; `lint`: grid, contrast, palette, controls and map-build green — `check-boundaries`
  is the 4 pre-existing insurance-rules findings on `spec/3630-map-chart`, none from here.
- **Seen in the browser (dev proof page, network off, headless Edge):** en + ar `drawn`, 0 console errors; zoomed out four
  steps, the proof's 20 Riyadh points join into one neutral group reading "20" (`.issues/assets/881-proof-group-dev.png`).
  The proof page passes no legend, so sizes, colours and the card are not on it.
- **Status stays `open`** (as 879): Done-when needs every proof box, and the "seen by a person" box — Riyadh's stores as groups that open on zoom, on the local stack with a real
  map answer. Not done here: a pinned card stays where it was tapped while the map pans (it is closed by the next tap).
- **For 882:** `readMapLegend` reads `notOnMap`; the table fallback still lists `hollow`/`colour_step` (role `legend`) —
  "Show as table" should skip that role.

**2026-11-17 — seen by the owner.** The owner looked at the screenshots/PDFs under `.issues/assets/` and said they look fine, and to stay with the map decisions (dots sized and coloured, names on the card, no pins, no always-on labels). The person-check box is ticked and the ticket closed.
